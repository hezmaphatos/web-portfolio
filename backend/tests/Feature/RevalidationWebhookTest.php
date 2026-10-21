<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

/**
 * The real webhook (docs/API.md → Revalidation webhook): URL, secret header, tags, and that a
 * failing frontend is logged without failing the admin request. Deferred callbacks run inline.
 */
class RevalidationWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const FRONTEND = 'http://frontend.test';

    private const ENDPOINT = self::FRONTEND.'/api/revalidate';

    private const SECRET = 'test-revalidate-secret';

    protected function setUp(): void
    {
        parent::setUp();

        config(['portfolio.frontend_url' => self::FRONTEND, 'portfolio.revalidate_secret' => self::SECRET]);
        Storage::fake('public');
        Storage::fake('local');
        $this->withoutDefer();
        $this->actingAsAdmin();
    }

    /**
     * @param  array<int, string>  $tags
     */
    private function assertWebhookSent(array $tags): void
    {
        Http::assertSent(fn (Request $request) => $request->url() === self::ENDPOINT
            && $request->method() === 'POST'
            && $request->hasHeader('x-revalidate-secret', self::SECRET)
            && $request->data() === ['tags' => $tags]);
    }

    public function test_a_project_rename_sends_the_old_and_new_slug_tags(): void
    {
        Http::fake([self::ENDPOINT => Http::response(['ok' => true])]);
        $project = Project::factory()->create(['slug' => 'old-slug']);

        $this->putJson('/api/v1/admin/projects/'.$project['id'], ['slug' => 'new-slug'])->assertOk();

        Http::assertSentCount(1);
        $this->assertWebhookSent(['home', 'projects', 'project:new-slug', 'project:old-slug']);
    }

    public function test_a_failing_frontend_is_logged_and_never_fails_the_request(): void
    {
        Log::spy();
        Http::fake([self::ENDPOINT => Http::response('boom', 500)]);
        $project = Project::factory()->create(['slug' => 'mindlens']);

        $this->putJson('/api/v1/admin/projects/'.$project['id'], ['title' => 'Mindlens v2'])->assertOk();

        Log::shouldHaveReceived('warning')
            ->with('Revalidation failed.', Mockery::on(fn (array $context) => $context['status'] === 500))
            ->once();
    }

    public function test_an_unreachable_frontend_is_logged_and_never_fails_the_request(): void
    {
        Log::spy();
        Http::fake(fn () => throw new ConnectionException('Connection timed out'));
        $project = Project::factory()->create();

        $this->putJson('/api/v1/admin/projects/'.$project['id'], ['title' => 'Still saved'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Still saved');

        Log::shouldHaveReceived('warning')
            ->with('Revalidation failed.', Mockery::on(fn (array $context) => $context['error'] === 'Connection timed out'))
            ->once();
    }

    public function test_nothing_is_sent_without_a_secret(): void
    {
        config(['portfolio.revalidate_secret' => '']);
        Log::spy();
        Http::fake();
        $project = Project::factory()->create();

        $this->putJson('/api/v1/admin/projects/'.$project['id'], ['title' => 'Unsent'])->assertOk();

        Http::assertNothingSent();
        Log::shouldHaveReceived('warning')->with('Revalidation skipped: REVALIDATE_SECRET is not set.', Mockery::any())->once();
    }

    public function test_media_alt_and_replace_revalidate_home_and_projects(): void
    {
        Http::fake([self::ENDPOINT => Http::response(['ok' => true])]);
        $media = Media::factory()->create();

        $this->patchJson('/api/v1/admin/media/'.$media['id'], ['alt' => 'New alt'])->assertOk();
        $this->assertWebhookSent(['home', 'projects']);

        $this->post(
            '/api/v1/admin/media/'.$media['id'].'/replace',
            ['file' => UploadedFile::fake()->image('new.jpg', 120, 80)],
            ['Accept' => 'application/json'],
        )->assertOk();

        Http::assertSentCount(2);
    }

    public function test_media_upload_and_delete_of_unused_media_send_nothing(): void
    {
        Http::fake();

        $id = $this->post('/api/v1/admin/media', ['files' => [UploadedFile::fake()->image('a.jpg', 50, 50)]], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.0.id');
        $this->deleteJson('/api/v1/admin/media/'.$id)->assertOk();

        Http::assertNothingSent();
    }
}
