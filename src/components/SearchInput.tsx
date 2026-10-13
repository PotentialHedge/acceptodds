'use client';

import type { ComponentProps, FormEvent } from 'react';

/**
 * A search box that submits its form when its clear button (the browser's ×) empties it, so the
 * results follow. Typing or deleting down to nothing does not: only a clear, which the browser
 * sends as an input event without an `inputType`.
 */
export function SearchInput(props: Omit<ComponentProps<'input'>, 'type' | 'onInput'>) {
  function onInput(e: FormEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const native = e.nativeEvent as Partial<InputEvent>;
    if (input.value === '' && !native.inputType) input.form?.requestSubmit();
  }
  return <input {...props} type="search" onInput={onInput} />;
}
