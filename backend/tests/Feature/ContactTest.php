<?php

namespace Tests\Feature;

use App\Mail\NewContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

class ContactTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/public/contact';

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'message' => 'Hello there, I would love to work with you.',
            'website' => '',
        ], $overrides);
    }

    public function test_valid_submission_is_stored_with_a_hashed_ip(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->withHeader('User-Agent', str_repeat('a', 300))
            ->postJson(self::URL, $this->payload())
            ->assertCreated()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseHas('messages', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'message' => 'Hello there, I would love to work with you.',
            'ip_hash' => hash_hmac('sha256', '203.0.113.7', (string) config('app.key')),
            'user_agent' => str_repeat('a', 255),
            'read_at' => null,
        ]);
        $this->assertDatabaseMissing('messages', ['ip_hash' => '203.0.113.7']);
    }

    public function test_filled_honeypot_returns_201_and_stores_nothing(): void
    {
        config(['mail.default' => 'smtp', 'portfolio.admin.email' => 'owner@example.test']);
        Mail::fake();

        $this->postJson(self::URL, $this->payload(['website' => 'https://spam.example']))
            ->assertCreated()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseCount('messages', 0);
        Mail::assertNothingQueued();
    }

    public function test_invalid_submission_returns_422(): void
    {
        $this->postJson(self::URL, $this->payload(['email' => 'not-an-email', 'message' => 'Too short']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'message'])
            ->assertJsonMissingValidationErrors(['name', 'website']);

        $this->postJson(self::URL, ['website' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'message']);

        $this->postJson(self::URL, $this->payload(['name' => 'A', 'message' => str_repeat('x', 5001)]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'message']);

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_sixth_submission_within_an_hour_is_throttled(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson(self::URL, $this->payload())->assertCreated();
        }

        $this->postJson(self::URL, $this->payload())
            ->assertTooManyRequests()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseCount('messages', 5);
    }

    public function test_notification_is_queued_when_a_real_mailer_is_configured(): void
    {
        config(['mail.default' => 'smtp', 'portfolio.admin.email' => 'owner@example.test']);
        Mail::fake();

        $this->postJson(self::URL, $this->payload())->assertCreated();

        Mail::assertQueued(NewContactMessage::class, fn (NewContactMessage $mail) => $mail->hasTo('owner@example.test'));
        Mail::assertNothingSent();
    }

    public function test_no_notification_with_the_log_mailer_or_without_admin_email(): void
    {
        Mail::fake();

        config(['mail.default' => 'log', 'portfolio.admin.email' => 'owner@example.test']);
        $this->postJson(self::URL, $this->payload())->assertCreated();

        config(['mail.default' => 'smtp', 'portfolio.admin.email' => null]);
        $this->postJson(self::URL, $this->payload())->assertCreated();

        Mail::assertNothingQueued();
        Mail::assertNothingSent();
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_mail_failure_never_fails_the_request(): void
    {
        config(['mail.default' => 'smtp', 'portfolio.admin.email' => 'owner@example.test']);
        Mail::shouldReceive('to')->andThrow(new RuntimeException('Queue is down'));
        Log::shouldReceive('warning')->once();

        $this->postJson(self::URL, $this->payload())
            ->assertCreated()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseCount('messages', 1);
    }

    public function test_notification_mail_content(): void
    {
        $mail = new NewContactMessage([
            'id' => 1,
            'name' => "Ada\r\nBcc: evil@example.com",
            'email' => 'ada@example.com',
            'message' => "Let's build <something> & ship it.",
        ]);

        $mail->assertHasSubject('New message from Ada Bcc: evil@example.com');
        $mail->assertHasReplyTo('ada@example.com');
        $mail->assertSeeInText("Let's build <something> & ship it.", false);
        $mail->assertSeeInText('ada@example.com');
    }
}
