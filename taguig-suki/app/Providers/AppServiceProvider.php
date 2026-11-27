<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\MessageConverter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureHttpMailTransports();
    }

    /**
     * Register lightweight HTTP-based mail transports (Resend, Brevo, Webhook) so emails
     * can be delivered over HTTPS (port 443) when outbound SMTP ports are restricted.
     */
    protected function configureHttpMailTransports(): void
    {
        if (! class_exists(\Resend::class)) {
            $this->registerHttpTransport('resend', function (array $mailData): void {
                $apiKey = (string) config('services.resend.key', '');
                if ($apiKey === '') {
                    throw new \RuntimeException('RESEND_API_KEY is not configured.');
                }

                $payload = array_filter([
                    'from' => $mailData['fromHeader'],
                    'to' => array_map(fn (array $recipient) => $recipient['email'], $mailData['to']),
                    'cc' => array_map(fn (array $recipient) => $recipient['email'], $mailData['cc']),
                    'bcc' => array_map(fn (array $recipient) => $recipient['email'], $mailData['bcc']),
                    'subject' => $mailData['subject'],
                    'html' => $mailData['html'],
                    'text' => $mailData['text'],
                ], fn ($value) => $value !== null && $value !== []);

                $response = Http::withToken($apiKey)->timeout(10)->post('https://api.resend.com/emails', $payload);
                if ($response->failed()) {
                    throw new \RuntimeException('Resend API error ('.$response->status().'): '.$response->body());
                }
            });
        }

        $this->registerHttpTransport('brevo', function (array $mailData): void {
            $apiKey = (string) config('services.brevo.key', '');
            if ($apiKey === '') {
                throw new \RuntimeException('BREVO_API_KEY is not configured.');
            }

            $payload = array_filter([
                'sender' => array_filter([
                    'name' => $mailData['fromName'] ?: config('mail.from.name', 'TaguigSuki'),
                    'email' => $mailData['fromEmail'],
                ]),
                'to' => array_map(fn (array $recipient) => array_filter($recipient), $mailData['to']),
                'cc' => array_map(fn (array $recipient) => array_filter($recipient), $mailData['cc']),
                'bcc' => array_map(fn (array $recipient) => array_filter($recipient), $mailData['bcc']),
                'subject' => $mailData['subject'],
                'htmlContent' => $mailData['html'],
                'textContent' => $mailData['text'],
            ], fn ($value) => $value !== null && $value !== []);

            $response = Http::withHeaders([
                'api-key' => $apiKey,
                'Accept' => 'application/json',
            ])->timeout(10)->post('https://api.brevo.com/v3/smtp/email', $payload);

            if ($response->failed()) {
                throw new \RuntimeException('Brevo API error ('.$response->status().'): '.$response->body());
            }
        });

        $this->registerHttpTransport('webhook', function (array $mailData): void {
            $url = (string) config('services.mail_webhook.url', '');
            if ($url === '') {
                throw new \RuntimeException('MAIL_WEBHOOK_URL is not configured.');
            }

            $secret = (string) config('services.mail_webhook.secret', '');
            $payload = array_filter([
                'secret' => $secret !== '' ? $secret : null,
                'from' => [
                    'email' => $mailData['fromEmail'],
                    'name' => $mailData['fromName'],
                ],
                'to' => $mailData['to'],
                'subject' => $mailData['subject'],
                'html' => $mailData['html'],
                'text' => $mailData['text'],
            ], fn ($value) => $value !== null);

            $response = Http::timeout(10)->post($url, $payload);
            if ($response->failed()) {
                throw new \RuntimeException('Mail webhook error ('.$response->status().'): '.$response->body());
            }
        });
    }

    /**
     * Register a custom HTTP mail driver backed by a transport sender callback.
     */
    protected function registerHttpTransport(string $driver, \Closure $sender): void
    {
        Mail::extend($driver, function () use ($driver, $sender) {
            return new class($driver, $sender) extends AbstractTransport
            {
                public function __construct(
                    private readonly string $driverName,
                    private readonly \Closure $sender,
                ) {
                    parent::__construct();
                }

                protected function doSend(SentMessage $message): void
                {
                    $email = MessageConverter::toEmail($message->getOriginalMessage());
                    $from = $email->getFrom()[0] ?? null;
                    $fromEmail = $from?->getAddress() ?: (string) config('mail.from.address', 'hello@example.com');
                    $fromName = $from?->getName() ?: (string) config('mail.from.name', 'TaguigSuki');
                    $fromHeader = $from ? $from->toString() : sprintf('%s <%s>', $fromName, $fromEmail);

                    $mapAddresses = static fn (array $addresses): array => array_map(
                        static fn (Address $addr): array => [
                            'email' => $addr->getAddress(),
                            'name' => $addr->getName(),
                        ],
                        $addresses
                    );

                    ($this->sender)([
                        'fromEmail' => $fromEmail,
                        'fromName' => $fromName,
                        'fromHeader' => $fromHeader,
                        'to' => $mapAddresses($email->getTo()),
                        'cc' => $mapAddresses($email->getCc()),
                        'bcc' => $mapAddresses($email->getBcc()),
                        'subject' => $email->getSubject(),
                        'html' => $email->getHtmlBody(),
                        'text' => $email->getTextBody(),
                    ]);
                }

                public function __toString(): string
                {
                    return $this->driverName;
                }
            };
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
