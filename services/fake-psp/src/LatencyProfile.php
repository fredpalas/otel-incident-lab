<?php

declare(strict_types=1);

namespace FakePsp;

/** How long the acquiring bank takes to answer, per environment profile. */
final class LatencyProfile
{
    private function __construct(private readonly string $name)
    {
    }

    public static function fromEnv(): self
    {
        return new self(getenv('PSP_LATENCY_PROFILE') ?: 'fast');
    }

    public function name(): string
    {
        return $this->name;
    }

    public function nextDelayMs(): int
    {
        if ($this->name !== 'longtail') {
            return random_int(20, 60);
        }

        $roll = random_int(1, 100);

        return match (true) {
            $roll <= 90 => random_int(50, 100),
            $roll <= 98 => random_int(300, 600),
            default => random_int(1500, 3000),
        };
    }
}
