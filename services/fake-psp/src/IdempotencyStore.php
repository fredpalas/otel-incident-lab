<?php

declare(strict_types=1);

namespace FakePsp;

/**
 * Stripe-style idempotency: the first request with a key creates the charge, any later
 * request with the same key gets that same charge back instead of a new one.
 * One file per key, guarded by flock, because PHP requests share no memory.
 */
final class IdempotencyStore
{
    public function __construct(private readonly string $directory = '/tmp/psp-idempotency')
    {
        if (!is_dir($this->directory)) {
            @mkdir($this->directory, 0o777, true);
        }
    }

    /**
     * @param callable(): array $create
     * @return array{0: array, 1: bool} the charge and whether it was replayed
     */
    public function remember(string $key, callable $create): array
    {
        $handle = fopen($this->directory . '/' . hash('sha256', $key) . '.json', 'c+');
        if ($handle === false) {
            return [$create(), false];
        }

        try {
            flock($handle, LOCK_EX);
            $stored = stream_get_contents($handle);
            if (is_string($stored) && $stored !== '') {
                return [json_decode($stored, true, flags: JSON_THROW_ON_ERROR), true];
            }

            $charge = $create();
            fwrite($handle, json_encode($charge, JSON_THROW_ON_ERROR));
            fflush($handle);

            return [$charge, false];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
