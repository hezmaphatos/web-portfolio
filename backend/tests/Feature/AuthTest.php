<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const OLD_PASSWORD = 'old-password-123';

    private const NEW_PASSWORD = 'correct-horse-battery-staple';

    public function test_login_returns_a_token_that_authenticates_admin_requests(): void
    {
        config(['sanctum.token_prefix' => 'hk_']);
        $user = $this->admin();

        $response = $this->postJson('/api/v1/admin/login', [
            'email' => $user->email,
            'password' => self::OLD_PASSWORD,
        ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email']]])
            ->assertJsonPath('data.user', ['id' => $user->id, 'name' => $user->name, 'email' => $user->email]);

        $token = $response->json('data.token');
        $this->assertMatchesRegularExpression('/^\d+\|hk_[A-Za-z0-9]{40}/', $token);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class,
            'name' => 'admin',
        ]);

        $this->forgetGuards();
        $this->getJson('/api/v1/admin/me', $this->bearer($token))
            ->assertOk()
            ->assertExactJson(['data' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email]]);
    }

    public function test_login_rejects_a_wrong_password(): void
    {
        $user = $this->admin();

        $this->postJson('/api/v1/admin/login', ['email' => $user->email, 'password' => 'wrong-password-123'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email', ['These credentials do not match our records.'])
            ->assertJsonMissingPath('data');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_login_rejects_an_unknown_email(): void
    {
        $this->admin();

        $this->postJson('/api/v1/admin/login', ['email' => 'nobody@example.com', 'password' => self::OLD_PASSWORD])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email', ['These credentials do not match our records.']);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_login_validates_the_payload(): void
    {
        $this->postJson('/api/v1/admin/login', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_is_throttled_after_five_attempts_per_minute(): void
    {
        $user = $this->admin();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/admin/login', ['email' => $user->email, 'password' => 'wrong-password-123'])
                ->assertUnprocessable();
        }

        // Even the right password is refused until the window resets.
        $this->postJson('/api/v1/admin/login', ['email' => $user->email, 'password' => self::OLD_PASSWORD])
            ->assertTooManyRequests()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_admin_routes_return_401_json_without_a_token(): void
    {
        $this->getJson('/api/v1/admin/me')
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'Unauthenticated.']);

        $this->getJson('/api/v1/admin/me', $this->bearer('1|not-a-real-token'))
            ->assertUnauthorized();
    }

    public function test_admin_routes_return_401_json_without_an_accept_header(): void
    {
        // A server-side fetch from the BFF sends `Accept: */*`: still 401 JSON, never a login redirect / 500.
        $this->get('/api/v1/admin/me')
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'Unauthenticated.']);

        $this->post('/api/v1/admin/media', [], ['Accept' => '*/*', 'Authorization' => 'Bearer 1|expired'])
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'Unauthenticated.']);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = $this->admin();
        $current = $this->login($user->email, self::OLD_PASSWORD);
        $other = $user->createToken('admin')->plainTextToken;

        $this->forgetGuards();
        $this->postJson('/api/v1/admin/logout', [], $this->bearer($current))
            ->assertOk()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->forgetGuards();
        $this->getJson('/api/v1/admin/me', $this->bearer($current))->assertUnauthorized();

        $this->forgetGuards();
        $this->getJson('/api/v1/admin/me', $this->bearer($other))->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_password_change_rejects_a_wrong_current_password(): void
    {
        $user = $this->actingAsAdmin($this->admin());

        $this->putJson('/api/v1/admin/password', [
            'current_password' => 'not-my-password',
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password'])
            ->assertJsonMissingValidationErrors(['password']);

        $this->assertTrue(password_verify(self::OLD_PASSWORD, $user->fresh()->password));
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function invalidNewPasswords(): array
    {
        return [
            'too short (11 chars)' => ['short-pass1', 'short-pass1'],
            'not confirmed' => [self::NEW_PASSWORD, 'something-else-entirely'],
            'same as current' => [self::OLD_PASSWORD, self::OLD_PASSWORD],
            'longer than bcrypt reads' => [str_repeat('a', 73), str_repeat('a', 73)],
        ];
    }

    #[DataProvider('invalidNewPasswords')]
    public function test_password_change_validates_the_new_password(string $password, string $confirmation): void
    {
        $user = $this->actingAsAdmin($this->admin());

        $this->putJson('/api/v1/admin/password', [
            'current_password' => self::OLD_PASSWORD,
            'password' => $password,
            'password_confirmation' => $confirmation,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password'])
            ->assertJsonMissingValidationErrors(['current_password']);

        $this->assertTrue(password_verify(self::OLD_PASSWORD, $user->fresh()->password));
    }

    public function test_password_change_updates_the_hash_and_revokes_other_tokens(): void
    {
        $user = $this->admin();
        $current = $this->login($user->email, self::OLD_PASSWORD);
        $other = $user->createToken('admin')->plainTextToken;
        $currentId = (int) strtok($current, '|');

        $this->forgetGuards();
        $this->putJson('/api/v1/admin/password', [
            'current_password' => self::OLD_PASSWORD,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ], $this->bearer($current))
            ->assertOk()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $currentId]);

        $this->forgetGuards();
        $this->getJson('/api/v1/admin/me', $this->bearer($current))->assertOk();

        $this->forgetGuards();
        $this->getJson('/api/v1/admin/me', $this->bearer($other))->assertUnauthorized();

        $this->forgetGuards();
        $this->postJson('/api/v1/admin/login', ['email' => $user->email, 'password' => self::OLD_PASSWORD])
            ->assertUnprocessable();

        $this->forgetGuards();
        $this->postJson('/api/v1/admin/login', ['email' => $user->email, 'password' => self::NEW_PASSWORD])
            ->assertOk();
    }

    private function admin(): User
    {
        return User::factory()->create(['password' => self::OLD_PASSWORD]);
    }

    private function login(string $email, string $password): string
    {
        return $this->postJson('/api/v1/admin/login', ['email' => $email, 'password' => $password])
            ->assertOk()
            ->json('data.token');
    }

    /**
     * @return array<string, string>
     */
    private function bearer(string $token): array
    {
        return ['Authorization' => 'Bearer '.$token];
    }

    /** The resolved guard caches its user across requests within one test. */
    private function forgetGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
