/**
 * Chat Command Constants
 */

export enum Command {
  OPEN = 'open',
  CLOSE = 'close',
  CLEAR = 'clear',
  SET_LIMIT = 'setlimit',
  REMOVE_LIMIT = 'removelimit',
  PREV = 'prev',
  NEXT = 'next',
  REMOVE_BY_SUBMITTER = 'removebysubmitter',
  REMOVE_BY_PLATFORM = 'removebyplatform',
  ENABLE_PLATFORM = 'enableplatform',
  DISABLE_PLATFORM = 'disableplatform',
  ENABLE_AUTOMOD = 'enableautomod',
  DISABLE_AUTOMOD = 'disableautomod',
  PURGE_CACHE = 'purgecache',
  PURGE_HISTORY = 'purgehistory'
}

export type CommandValue = `${Command}`
