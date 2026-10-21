<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Admin login with Sanctum personal access tokens (docs/API.md → Auth).
 * Token prefix and expiry come from config/sanctum.php.
 */
class AuthService
{
    public const TOKEN_NAME = 'admin';

    /**
     * Checked when the email is unknown, so a miss costs the same as a wrong password
     * (bcrypt, cost 12 = the production BCRYPT_ROUNDS; the plain value is random and discarded).
     */
    private const DUMMY_HASH = '$2y$12$gmRWar9zxBGk0f7dbvY8cu06iyE7bRd2uhVHiQp2GKXfI17ox5OHO';

    /**
     * @return array{token: string, user: array{id: int, name: string, email: string}}
     *
     * @throws ValidationException
     */
    public function login(string $email, #[\SensitiveParameter] string $password): array
    {
        $user = User::query()->where('email', $email)->first();

        $valid = Hash::check($password, $user !== null ? $user['password'] : self::DUMMY_HASH);

        if ($user === null || ! $valid) {
            throw ValidationException::withMessages(['email' => [__('auth.failed')]]);
        }

        return [
            'token' => $user->createToken(self::TOKEN_NAME)->plainTextToken,
            'user' => $this->present($user),
        ];
    }

    /**
     * Revokes only the token the request was authenticated with.
     *
     * @return array{ok: true}
     */
    public function logout(User $user): array
    {
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return ['ok' => true];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    public function me(User $user): array
    {
        return $this->present($user);
    }

    /**
     * The current password was verified by UpdatePasswordRequest. Every other token of the
     * user is revoked; the one making this request stays valid.
     *
     * @return array{ok: true}
     */
    public function updatePassword(User $user, #[\SensitiveParameter] string $password): array
    {
        $currentTokenId = $this->currentTokenId($user);

        DB::transaction(function () use ($user, $password, $currentTokenId) {
            $user->update(['password' => $password]); // hashed by the model's `hashed` cast

            $user->tokens()
                ->when($currentTokenId !== null, fn ($query) => $query->whereKeyNot($currentTokenId))
                ->delete();
        });

        return ['ok' => true];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private function present(User $user): array
    {
        return [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
        ];
    }

    /** Null when the request was not authenticated with a stored token (e.g. Sanctum::actingAs). */
    private function currentTokenId(User $user): ?int
    {
        $token = $user->currentAccessToken();
        $id = $token instanceof PersonalAccessToken ? $token['id'] : null;

        return is_int($id) ? $id : null;
    }
}
