<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use FakePsp\Charge;
use FakePsp\LatencyProfile;
use OpenTelemetry\API\Baggage\Baggage;
use OpenTelemetry\API\Globals;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    // No keep-alive towards merchants: every charge is its own connection.
    header('Connection: close');
    echo json_encode($body, JSON_THROW_ON_ERROR);
    // Answer the client before telemetry is flushed at shutdown.
    if (function_exists('frankenphp_finish_request')) {
        frankenphp_finish_request();
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if ($method === 'GET' && $path === '/health') {
    respond(200, ['status' => 'ok']);
    return;
}

if ($method !== 'POST' || $path !== '/charges') {
    respond(404, ['error' => 'not_found']);
    return;
}

$context = Globals::propagator()->extract(getallheaders());
$tracer = Globals::tracerProvider()->getTracer('fake-psp');
$span = $tracer->spanBuilder('POST /charges')
    ->setSpanKind(SpanKind::KIND_SERVER)
    ->setParent($context)
    ->setAttribute('http.request.method', 'POST')
    ->setAttribute('http.route', '/charges')
    ->startSpan();
$scope = $span->storeInContext($context)->activate();

try {
    // Merchants send business context as Baggage; it is kept on our spans for support.
    foreach (Baggage::fromContext($context)->getAll() as $key => $entry) {
        $span->setAttribute((string) $key, (string) $entry->getValue());
    }

    $latency = LatencyProfile::fromEnv();
    usleep($latency->nextDelayMs() * 1000);
    $span->setAttribute('psp.latency_profile', $latency->name());

    $payload = json_decode((string) file_get_contents('php://input'), true);
    $charge = Charge::fromPayload(is_array($payload) ? $payload : []);

    $span->setAttribute('psp.charge.id', $charge->id);
    $span->setAttribute('psp.charge.amount', $charge->amount);
    $span->setAttribute('psp.charge.currency', $charge->currency);
    $span->setAttribute('customer.email', $charge->customerEmail());
    $span->setAttribute('card.last4', $charge->cardLast4());
    $span->setAttribute('http.response.status_code', 201);

    respond(201, $charge->toArray());
} catch (\InvalidArgumentException $e) {
    $span->setAttribute('http.response.status_code', 422);
    $span->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());
    respond(422, ['error' => 'invalid_request', 'message' => $e->getMessage()]);
} finally {
    $scope->detach();
    $span->end();
}
