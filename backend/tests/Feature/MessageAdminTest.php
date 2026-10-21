<?php

namespace Tests\Feature;

use App\Models\Message;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageAdminTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/messages';

    public function test_guests_get_401(): void
    {
        $id = Message::factory()->create()['id'];

        $this->getJson(self::URL)->assertUnauthorized()->assertJsonStructure(['message']);
        $this->getJson(self::URL."/{$id}")->assertUnauthorized();
        $this->patchJson(self::URL."/{$id}/read", ['read' => true])->assertUnauthorized();
        $this->deleteJson(self::URL."/{$id}")->assertUnauthorized();

        $this->assertDatabaseHas('messages', ['id' => $id, 'read_at' => null]);
    }

    public function test_index_paginates_newest_first(): void
    {
        $this->actingAsAdmin();

        for ($i = 1; $i <= 25; $i++) {
            Message::factory()->create(['name' => "Sender {$i}", 'created_at' => now()->subMinutes(100 - $i)]);
        }

        $response = $this->getJson(self::URL)->assertOk();
        $response->assertJsonPath('meta', ['current_page' => 1, 'last_page' => 2, 'per_page' => 20, 'total' => 25]);
        $response->assertJsonCount(20, 'data');
        $response->assertJsonPath('data.0.name', 'Sender 25');

        $response = $this->getJson(self::URL.'?per_page=10&page=3')->assertOk();
        $response->assertJsonPath('meta', ['current_page' => 3, 'last_page' => 3, 'per_page' => 10, 'total' => 25]);
        $response->assertJsonCount(5, 'data');
        $response->assertJsonPath('data.4.name', 'Sender 1');

        $first = $response->json('data.0');
        $this->assertSame(['id', 'name', 'email', 'message', 'read_at', 'created_at'], array_keys($first));
        $this->assertIsInt($first['id']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/', $first['created_at']);

        $this->getJson(self::URL.'?per_page=101')->assertUnprocessable()->assertJsonValidationErrors(['per_page']);
        $this->getJson(self::URL.'?page=0')->assertUnprocessable()->assertJsonValidationErrors(['page']);
    }

    public function test_unread_filter(): void
    {
        $this->actingAsAdmin();
        $unread = Message::factory()->count(2)->create();
        Message::factory()->read()->count(3)->create();

        $response = $this->getJson(self::URL.'?unread=1')->assertOk();
        $response->assertJsonPath('meta.total', 2);
        $this->assertEqualsCanonicalizing(
            [$unread[0]['id'], $unread[1]['id']],
            array_column($response->json('data'), 'id'),
        );

        $this->getJson(self::URL.'?unread=0')->assertOk()->assertJsonPath('meta.total', 5);
        $this->getJson(self::URL.'?unread=&q=')->assertOk()->assertJsonPath('meta.total', 5);
    }

    public function test_search_matches_name_email_and_message(): void
    {
        $this->actingAsAdmin();
        $byName = Message::factory()->create(['name' => 'Grace Hopper', 'email' => 'g@example.com', 'message' => 'Compilers are fun.']);
        $byEmail = Message::factory()->create(['name' => 'Linus', 'email' => 'hopper.fan@example.com', 'message' => 'Kernels are fun.']);
        $byMessage = Message::factory()->create(['name' => 'Alan', 'email' => 'a@example.com', 'message' => 'I met Hopper once.']);
        Message::factory()->create(['name' => 'Bob', 'email' => 'b@example.com', 'message' => 'Unrelated text here.']);

        $response = $this->getJson(self::URL.'?q=hopper')->assertOk();
        $response->assertJsonPath('meta.total', 3);
        $this->assertEqualsCanonicalizing(
            [$byName['id'], $byEmail['id'], $byMessage['id']],
            array_column($response->json('data'), 'id'),
        );

        Message::factory()->read()->create(['name' => 'Hopper Read']);
        $this->getJson(self::URL.'?q=hopper&unread=1')->assertOk()->assertJsonPath('meta.total', 3);
    }

    public function test_show_returns_the_message_shape(): void
    {
        $this->actingAsAdmin();
        $message = Message::factory()->create(['name' => 'Ada', 'email' => 'ada@example.com', 'message' => 'Hello there, friend.']);

        $this->getJson(self::URL."/{$message['id']}")
            ->assertOk()
            ->assertExactJson(['data' => [
                'id' => $message['id'],
                'name' => 'Ada',
                'email' => 'ada@example.com',
                'message' => 'Hello there, friend.',
                'read_at' => null,
                'created_at' => $message['created_at']->toJSON(),
            ]]);

        $this->getJson(self::URL.'/999999')->assertNotFound()->assertExactJson(['message' => 'Not found.']);
    }

    public function test_mark_read_and_unread(): void
    {
        $this->actingAsAdmin();
        $id = Message::factory()->create()['id'];

        $readAt = $this->patchJson(self::URL."/{$id}/read", ['read' => true])
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->json('data.read_at');
        $this->assertNotNull($readAt);
        $this->assertNotNull(Message::query()->findOrFail($id)['read_at']);

        $this->travel(5)->minutes();
        $this->patchJson(self::URL."/{$id}/read", ['read' => true])
            ->assertOk()
            ->assertJsonPath('data.read_at', $readAt);

        $this->patchJson(self::URL."/{$id}/read", ['read' => false])
            ->assertOk()
            ->assertJsonPath('data.read_at', null);
        $this->assertDatabaseHas('messages', ['id' => $id, 'read_at' => null]);

        $this->patchJson(self::URL."/{$id}/read", [])->assertUnprocessable()->assertJsonValidationErrors(['read']);
        $this->patchJson(self::URL."/{$id}/read", ['read' => 'maybe'])->assertUnprocessable();
        $this->patchJson(self::URL.'/999999/read', ['read' => true])->assertNotFound();
    }

    public function test_delete(): void
    {
        $this->actingAsAdmin();
        $id = Message::factory()->create()['id'];

        $this->deleteJson(self::URL."/{$id}")
            ->assertOk()
            ->assertExactJson(['data' => ['ok' => true]]);
        $this->assertDatabaseMissing('messages', ['id' => $id]);

        $this->deleteJson(self::URL."/{$id}")->assertNotFound();
    }
}
