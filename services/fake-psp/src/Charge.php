<?php

declare(strict_types=1);

namespace FakePsp;

final class Charge
{
    /** Per-transaction limit agreed with the merchant (1,000.00 in minor units). */
    public const MAX_AMOUNT = 100_000;

    private function __construct(
        public readonly string $id,
        public readonly int $amount,
        public readonly string $currency,
        public readonly string $reference,
        public readonly string $customerId,
    ) {
    }

    /** @throws \InvalidArgumentException */
    public static function fromPayload(array $payload): self
    {
        $amount = $payload['amount'] ?? null;
        if (!is_int($amount) || $amount <= 0) {
            throw new \InvalidArgumentException('amount must be a positive integer in minor units');
        }
        if ($amount > self::MAX_AMOUNT) {
            throw new \InvalidArgumentException('amount exceeds the per-transaction limit');
        }
        $currency = $payload['currency'] ?? null;
        if (!is_string($currency) || !preg_match('/^[A-Z]{3}$/', $currency)) {
            throw new \InvalidArgumentException('currency must be an ISO 4217 code');
        }

        return new self(
            'ch_' . bin2hex(random_bytes(8)),
            $amount,
            $currency,
            (string) ($payload['reference'] ?? ''),
            (string) ($payload['customer_id'] ?? ''),
        );
    }

    /** Card-on-file data from the vault. */
    public function cardLast4(): string
    {
        return str_pad((string) (crc32($this->customerId) % 10000), 4, '0', STR_PAD_LEFT);
    }

    public function customerEmail(): string
    {
        return strtolower(preg_replace('/[^a-z0-9]+/i', '.', $this->customerId) ?: 'customer') . '@customers.example';
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'status' => 'captured',
            'amount' => $this->amount,
            'currency' => $this->currency,
            'reference' => $this->reference,
        ];
    }
}
