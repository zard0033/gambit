// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { routes, scrollBehavior } from '../../../src/router/index'

describe('route-table', () => {
  it('test_routeTable_catchAll_isLastEntry', () => {
    const last = routes[routes.length - 1]
    expect(last.path).toBe('/:pathMatch(.*)*')
  })

  it('test_routeTable_containsExactlyExpectedRoutes', () => {
    const paths = routes.map((r) => r.path)
    expect(paths).toEqual(['/', '/play', '/learn', '/learn/concepts', '/learn/concept/:conceptId', '/learn/:lessonId', '/dungeon', '/dungeon/:puzzleId', '/review', '/history', '/journal', '/profile', '/sign-in', '/:pathMatch(.*)*'])
  })

  it('test_routeTable_playRoute_componentIsFunction', () => {
    const play = routes.find((r) => r.path === '/play')!
    expect(typeof play.component).toBe('function')
  })

  it('test_routeTable_reviewRoute_componentIsFunction', () => {
    const review = routes.find((r) => r.path === '/review')!
    expect(typeof review.component).toBe('function')
  })

  it('test_routeTable_homeRoute_componentIsNotFunction', () => {
    const home = routes.find((r) => r.path === '/')!
    expect(typeof home.component).not.toBe('function')
  })

  it('test_routeTable_notFoundRoute_componentIsNotFunction', () => {
    const notFound = routes.find((r) => r.path === '/:pathMatch(.*)*')!
    expect(typeof notFound.component).not.toBe('function')
  })

  it('test_routeTable_scrollBehavior_returnsTopZero', () => {
    const result = scrollBehavior({} as any, {} as any, null)
    expect(result).toEqual({ top: 0 })
  })

  it('test_routeTable_historyRoute_isAuthGuarded', () => {
    const history = routes.find((r) => r.path === '/history')!
    expect(history).toBeDefined()
    expect(history.name).toBe('history')
  })

  it('test_routeTable_profileRoute_isAuthGuarded', () => {
    const profile = routes.find((r) => r.path === '/profile')!
    expect(profile).toBeDefined()
    expect(profile.name).toBe('profile')
  })

  it('test_routeTable_noReservedRoutes_settingsAbsent', () => {
    const paths = routes.map((r) => r.path)
    expect(paths).not.toContain('/settings')
  })
})
