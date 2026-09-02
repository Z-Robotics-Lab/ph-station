/**
 * The media byte route's guard, `mediaFile`, over a tmp runs/ fixture: only
 * `runs/<session>/media/...` regular files with a known extension resolve, and
 * every traversal shape (`..`, encoded, absolute, symlink escaping the session)
 * reads as undefined (→ 404). No storecli is spawned.
 */

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mediaFile } from '../src/index.ts'

let runs: string

beforeAll(async () => {
  runs = await mkdtemp(join(tmpdir(), 'dsh-ph-board-media-'))
  const clip = join(runs, 's1', 'media', 'kitchen_thaw', '1')
  await mkdir(clip, { recursive: true })
  for (const f of ['grasp.mp4', 'grasp.gif', 'grasp.png', 'grasp.jpg', 'meta.json', 'notes.txt']) await writeFile(join(clip, f), f)
  await mkdir(join(runs, 's1', 'campaigns'), { recursive: true })
  await writeFile(join(runs, 's1', 'campaigns', 'campaign.json'), '{}')
  await writeFile(join(runs, 'secret.mp4'), 'secret')
  await symlink(join(runs, 'secret.mp4'), join(clip, 'leak.mp4'))
  await symlink(join(clip, 'grasp.gif'), join(clip, 'alias.gif'))
})

afterAll(async () => { await rm(runs, { recursive: true, force: true }) })

describe('mediaFile', () => {
  it('serves media/ files with the content type of their extension', async () => {
    const clip = join(runs, 's1', 'media', 'kitchen_thaw', '1')
    expect(await mediaFile(runs, 's1/media/kitchen_thaw/1/grasp.mp4')).toEqual({ file: join(clip, 'grasp.mp4'), type: 'video/mp4' })
    expect((await mediaFile(runs, 's1/media/kitchen_thaw/1/grasp.gif'))?.type).toBe('image/gif')
    expect((await mediaFile(runs, 's1/media/kitchen_thaw/1/grasp.png'))?.type).toBe('image/png')
    expect((await mediaFile(runs, 's1/media/kitchen_thaw/1/grasp.jpg'))?.type).toBe('image/jpeg')
    expect((await mediaFile(runs, 's1/media/kitchen_thaw/1/meta.json'))?.type).toBe('application/json')
    // Percent-encoded segments decode; a symlink that stays inside the session is fine.
    expect((await mediaFile(runs, 's1/media/kitchen%5Fthaw/1/alias.gif'))?.file).toBe(join(clip, 'grasp.gif'))
  })

  it('refuses everything outside runs/<session>/media/', async () => {
    const refused = [
      's1/campaigns/campaign.json', // media/ prefix required, even for an existing file
      's1/media/kitchen_thaw/1/notes.txt', // unknown extension
      's1/media/kitchen_thaw/1/missing.mp4',
      's1/media/kitchen_thaw', // a directory
      's1/media/../campaigns/campaign.json',
      's1/media/%2e%2e/campaigns/campaign.json',
      's1/media/..%2Fcampaigns%2Fcampaign.json',
      's1/media//kitchen_thaw/1/grasp.mp4',
      's1/media/./kitchen_thaw/1/grasp.mp4',
      '../s1/media/kitchen_thaw/1/grasp.mp4',
      '/s1/media/kitchen_thaw/1/grasp.mp4',
      `${runs}/s1/media/kitchen_thaw/1/grasp.mp4`,
      's1/media/kitchen_thaw/1/leak.mp4', // symlink escaping the session dir
      's1/media/..\\..\\campaigns\\campaign.json', // backslash is a filename char on POSIX, a separator on Windows: the resolve() fence answers on both
      's1/media/kitchen_thaw/1/grasp%00.mp4', // a null byte reaches realpath, which throws rather than reads
      's1', '', 's1/', 's1/media/', '%E0%A4%A',
    ]
    for (const tail of refused) expect(await mediaFile(runs, tail), tail).toBeUndefined()
  })
})
