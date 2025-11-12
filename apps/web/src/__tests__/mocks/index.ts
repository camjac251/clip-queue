import type { Clip } from '@cq/platforms'
import { Platform } from '@cq/platforms'
import { ContentType } from '@cq/schemas/clip'

export * from './kick'
export * from './twitch'

export const clipFromKick: Clip = {
  platform: Platform.KICK,
  contentType: ContentType.CLIP,
  submitters: ['testsubmitterkick'],
  id: 'testclipkick',
  title: 'testclipkick',
  channel: 'testchannelkick',
  creator: 'testcreatorkick',
  category: 'testcategorykick',
  createdAt: '2024-02-22T08:47:27.000Z',
  url: 'https://kick.com/channel?clip=testclip',
  embedUrl: 'https://kick.com/channel?clip=testclip',
  thumbnailUrl: 'https://kick.com/thumbnail'
}

export const clipFromTwitch: Clip = {
  platform: Platform.TWITCH,
  contentType: ContentType.CLIP,
  submitters: ['testsubmittertwitch'],
  id: 'testcliptwitch',
  title: 'testcliptwitch',
  channel: 'testchanneltwitch',
  creator: 'testcreatortwitch',
  category: 'testcategorytwitch',
  createdAt: '2024-02-22T08:47:27.000Z',
  url: 'https://clips.twitch.tv/testclip',
  embedUrl: 'https://clips.twitch.tv/testclip',
  thumbnailUrl: 'https://twitch.tv/thumbnail'
}
