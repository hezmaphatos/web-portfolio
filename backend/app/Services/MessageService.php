<?php

namespace App\Services;

use App\Mail\NewContactMessage;
use App\Models\Message;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Contact form submissions and the admin inbox (docs/API.md → POST /public/contact, Messages).
 * Messages are private: nothing here triggers revalidation.
 */
class MessageService
{
    public const PER_PAGE = 20;

    /** Mailers that deliver nothing: no notification is queued for them. */
    private const NON_DELIVERING_MAILERS = ['log', 'array'];

    private const COLUMNS = ['id', 'name', 'email', 'message', 'read_at', 'created_at'];

    /**
     * Stores a contact message and queues the admin notification. A filled honeypot gets
     * the same answer but nothing is stored or sent, so bots cannot tell they were caught.
     *
     * @param  array{name: string, email: string, message: string, website?: mixed}  $data
     * @return array{ok: true}
     */
    public function submit(array $data, ?string $ip, ?string $userAgent): array
    {
        if (filled($data['website'] ?? null)) {
            return ['ok' => true];
        }

        $message = Message::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'message' => $data['message'],
            // Keyed hash: repeat senders can be spotted without storing the raw IP.
            'ip_hash' => $ip !== null && $ip !== '' ? hash_hmac('sha256', $ip, (string) config('app.key')) : null,
            'user_agent' => $userAgent !== null && $userAgent !== '' ? mb_substr($userAgent, 0, 255) : null,
        ]);

        $this->notifyAdmin([
            'id' => (int) $message['id'],
            'name' => $data['name'],
            'email' => $data['email'],
            'message' => $data['message'],
        ]);

        return ['ok' => true];
    }

    /**
     * Newest first. Filters: `unread` (read_at is null), `q` (name, email or message contains).
     *
     * @param  array{page?: int|string, per_page?: int|string, unread?: bool|int|string|null, q?: string|null}  $filters
     * @return array{data: array<int, array<string, mixed>>, meta: array{current_page: int, last_page: int, per_page: int, total: int}}
     */
    public function paginate(array $filters): array
    {
        $unread = filter_var($filters['unread'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $search = trim((string) ($filters['q'] ?? ''));

        $page = Message::query()
            ->select(self::COLUMNS)
            ->when($unread, fn ($query) => $query->whereNull('read_at'))
            ->when($search !== '', fn ($query) => $query->where(fn ($where) => $where
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('message', 'like', "%{$search}%")))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(
                perPage: (int) ($filters['per_page'] ?? self::PER_PAGE),
                page: (int) ($filters['page'] ?? 1),
            )
            ->toArray();

        return [
            'data' => array_map(fn (array $row) => $this->present($row), $page['data']),
            'meta' => [
                'current_page' => (int) $page['current_page'],
                'last_page' => (int) $page['last_page'],
                'per_page' => (int) $page['per_page'],
                'total' => (int) $page['total'],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function latest(int $limit): array
    {
        $rows = Message::query()
            ->select(self::COLUMNS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->toArray();

        return array_map(fn (array $row) => $this->present($row), $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function find(int $id): array
    {
        return $this->present(Message::query()->select(self::COLUMNS)->findOrFail($id)->toArray());
    }

    /**
     * Marking an already read message as read keeps its original read_at.
     *
     * @return array<string, mixed>
     */
    public function markRead(int $id, bool $read): array
    {
        $message = Message::query()->select(self::COLUMNS)->findOrFail($id);

        $message->update(['read_at' => $read ? ($message['read_at'] ?? now()) : null]);

        return $this->present($message->toArray());
    }

    /**
     * @return array{ok: true}
     */
    public function delete(int $id): array
    {
        Message::query()->findOrFail($id)->delete();

        return ['ok' => true];
    }

    /**
     * @param  array<string, mixed>  $row  a `messages` row as array
     * @return array{id: int, name: string, email: string, message: string, read_at: string|null, created_at: string|null}
     */
    public function present(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'message' => $row['message'],
            'read_at' => $row['read_at'],
            'created_at' => $row['created_at'],
        ];
    }

    /**
     * Queued only when a real mailer and ADMIN_EMAIL are configured. The message is already
     * stored, so a mail or queue failure is logged and never fails the visitor's request.
     *
     * @param  array{id: int, name: string, email: string, message: string}  $contact
     */
    private function notifyAdmin(array $contact): void
    {
        $to = (string) config('portfolio.admin.email');

        if ($to === '' || in_array(config('mail.default'), self::NON_DELIVERING_MAILERS, true)) {
            return;
        }

        try {
            Mail::to($to)->queue(new NewContactMessage($contact));
        } catch (Throwable $e) {
            Log::warning('Contact notification could not be queued.', [
                'message_id' => $contact['id'],
                'error' => $e->getMessage(),
            ]);
        }
    }
}
