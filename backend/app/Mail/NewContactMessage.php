<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Plain-text notification to ADMIN_EMAIL for a new contact message; "Reply" answers the sender.
 */
class NewContactMessage extends Mailable implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array{id: int, name: string, email: string, message: string}  $contact
     */
    public function __construct(private array $contact) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [new Address($this->contact['email'], $this->singleLine($this->contact['name']))],
            subject: 'New message from '.$this->singleLine($this->contact['name']),
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'mail.contact-message',
            with: [
                'senderName' => $this->contact['name'],
                'senderEmail' => $this->contact['email'],
                'body' => $this->contact['message'],
                'inboxUrl' => config('portfolio.frontend_url').'/admin/messages',
            ],
        );
    }

    /** Header values must not carry line breaks from user input. */
    private function singleLine(string $value): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }
}
