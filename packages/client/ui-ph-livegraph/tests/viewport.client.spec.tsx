// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadMp4 } from '../src/client/Viewport.tsx'

describe('rollout video download', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('hands the decoded MP4 to the browser with a session filename', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:rollout')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadMp4(btoa('mp4-video'), 'session-robocasa-rollout.mp4')

    const blob = create.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob).type).toBe('video/mp4')
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:rollout')
  })
})
