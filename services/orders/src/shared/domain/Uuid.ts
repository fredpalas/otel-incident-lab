import { randomBytes } from 'node:crypto';
import { InvalidArgumentError } from './InvalidArgumentError';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export abstract class Uuid {
  protected constructor(readonly value: string) {
    if (!UUID.test(value)) throw new InvalidArgumentError(`"${value}" is not a valid id`);
  }

  /** UUIDv7 (RFC 9562): time-ordered, so ids sort by creation time in indexes. */
  protected static v7(): string {
    const bytes = randomBytes(16);
    const ms = BigInt(Date.now());
    for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  equals(other: Uuid): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
