import { describe, it, expect } from 'vitest';
import { mediaKey } from '../src/lib/media';

describe('mediaKey', () => {
  it('gives the same key when only the signature changes', () => {
    const first = 'https://storage.googleapis.com/bucket/render-1.jpg?Expires=1&Signature=aaa';
    const resigned = 'https://storage.googleapis.com/bucket/render-1.jpg?Expires=2&Signature=bbb';
    expect(mediaKey(first)).toBe(mediaKey(resigned));
  });

  it('gives different keys for different images', () => {
    expect(mediaKey('https://storage.googleapis.com/bucket/render-1.jpg?Signature=a')).not.toBe(
      mediaKey('https://storage.googleapis.com/bucket/render-2.jpg?Signature=a')
    );
  });

  it('ignores a Google CDN size suffix so resized copies share one identity', () => {
    expect(mediaKey('https://lh3.googleusercontent.com/abc123=s1600-rw')).toBe(
      mediaKey('https://lh3.googleusercontent.com/abc123=s512')
    );
  });

  it('ignores the fragment', () => {
    expect(mediaKey('https://example.com/a.png#top')).toBe(mediaKey('https://example.com/a.png'));
  });

  it('keeps blob and data URLs exactly as they are', () => {
    expect(mediaKey('blob:https://flow.google.com/1234-abcd')).toBe('blob:https://flow.google.com/1234-abcd');
    expect(mediaKey('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('falls back to trimming the query when the URL cannot be parsed', () => {
    expect(mediaKey('not a url?x=1')).toBe('not a url');
  });
});
