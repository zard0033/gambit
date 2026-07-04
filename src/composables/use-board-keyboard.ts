/**
 * Keyboard navigation for the chess board.
 * ADR-0009: single roving focus cell approach (no 64-cell grid overlay).
 * AC: Arrow keys, Enter (select/commit), Escape, Home/End, PgUp/PgDn.
 * ARIA: assertive live region for move announcements; square aria-labels from FEN.
 */
import { ref, computed } from 'vue'
import { Chess } from 'chess.js'

export type KeyboardNavState = 'IDLE' | 'PIECE_SELECTED'

export interface PieceInfo {
  color: 'white' | 'black'
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'
}

const PIECE_TYPE_NAMES: Record<string, PieceInfo['type']> = {
  k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
}

const PIECE_TYPE_LABELS_ZH: Record<PieceInfo['type'], string> = {
  king: '國王', queen: '后', rook: '城堡', bishop: '主教', knight: '騎士', pawn: '兵',
}

const PIECE_COLOR_LABELS_ZH: Record<PieceInfo['color'], string> = {
  white: '白方', black: '黑方',
}

const FILES = 'abcdefgh'
const RANKS = '12345678'

/** Parse piece at a given square from a FEN string. Returns null if empty. */
export function getPieceAt(fen: string, square: string): PieceInfo | null {
  try {
    const chess = new Chess(fen)
    const piece = chess.get(square as Parameters<typeof chess.get>[0])
    if (!piece) return null
    return {
      color: piece.color === 'w' ? 'white' : 'black',
      type: PIECE_TYPE_NAMES[piece.type] ?? 'pawn',
    }
  } catch {
    return null
  }
}

/** Returns all legal destination squares for a piece at a given square. */
export function getLegalDestinations(fen: string, from: string): string[] {
  try {
    const chess = new Chess(fen)
    return chess
      .moves({ square: from as Parameters<typeof chess.moves>[0]['square'], verbose: true })
      .map(m => m.to)
  } catch {
    return []
  }
}

/** Compute the square aria-label for display. */
export function squareAriaLabel(square: string, fen: string): string {
  const piece = getPieceAt(fen, square)
  if (!piece) return `${square}，空格`
  return `${square}，${PIECE_COLOR_LABELS_ZH[piece.color]}${PIECE_TYPE_LABELS_ZH[piece.type]}`
}

/** Move a square one step in a direction, clamping at edges (no wrap). */
export function stepSquare(
  square: string,
  direction: 'up' | 'down' | 'left' | 'right',
  orientation: 'white' | 'black',
): string {
  const file = FILES.indexOf(square[0])
  const rank = RANKS.indexOf(square[1])
  if (file < 0 || rank < 0) return square

  // For a black-oriented board, visual up/down/left/right are physically reversed
  const flip = orientation === 'black'

  let df = 0
  let dr = 0
  switch (direction) {
    case 'up':    dr = flip ? -1 : +1; break
    case 'down':  dr = flip ? +1 : -1; break
    case 'left':  df = flip ? +1 : -1; break
    case 'right': df = flip ? -1 : +1; break
  }

  const newFile = Math.max(0, Math.min(7, file + df))
  const newRank = Math.max(0, Math.min(7, rank + dr))
  return FILES[newFile] + RANKS[newRank]
}

export interface BoardKeyboardDeps {
  /** Current FEN string for piece lookup. */
  getFen: () => string
  /** Board orientation. */
  getOrientation: () => 'white' | 'black'
  /** Player color — determines which pieces the player can select. */
  getPlayerColor: () => 'white' | 'black'
  /** Called when player attempts to commit a move. */
  onMoveAttempt: (from: string, to: string) => void
  /** Called when a piece is selected (parent should show legal move hints). */
  onPieceSelected: (square: string, legalDests: string[]) => void
  /** Called when selection is cleared. */
  onSelectionCleared: () => void
  /** Called to emit an assertive announcement. Returns actual string for testability. */
  announce?: (text: string) => void
}

export function useBoardKeyboard(deps: BoardKeyboardDeps) {
  const currentSquare = ref('e4')
  const selectedSquare = ref<string | null>(null)
  const keyboardState = ref<KeyboardNavState>('IDLE')
  const announcement = ref('')

  let _mergeTimer: ReturnType<typeof setTimeout> | null = null
  const _pendingAnnouncements: string[] = []

  function _flushAnnouncement(): void {
    if (_pendingAnnouncements.length === 0) return
    const merged = _pendingAnnouncements.splice(0).join(', ')
    announcement.value = merged
    deps.announce?.(merged)
  }

  function _announce(text: string): void {
    _pendingAnnouncements.push(text)
    if (_mergeTimer) clearTimeout(_mergeTimer)
    _mergeTimer = setTimeout(_flushAnnouncement, 100)
  }

  function _isOwnPiece(square: string): boolean {
    const piece = getPieceAt(deps.getFen(), square)
    return piece !== null && piece.color === deps.getPlayerColor()
  }

  function _isLegalDest(square: string): boolean {
    if (!selectedSquare.value) return false
    return getLegalDestinations(deps.getFen(), selectedSquare.value).includes(square)
  }

  function handleKeydown(e: KeyboardEvent): void {
    const orientation = deps.getOrientation()

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        currentSquare.value = stepSquare(currentSquare.value, 'up', orientation)
        break

      case 'ArrowDown':
        e.preventDefault()
        currentSquare.value = stepSquare(currentSquare.value, 'down', orientation)
        break

      case 'ArrowLeft':
        e.preventDefault()
        currentSquare.value = stepSquare(currentSquare.value, 'left', orientation)
        break

      case 'ArrowRight':
        e.preventDefault()
        currentSquare.value = stepSquare(currentSquare.value, 'right', orientation)
        break

      case 'Home': {
        e.preventDefault()
        // Jump to a-file on current rank
        const rank = currentSquare.value[1]
        currentSquare.value = orientation === 'white' ? `a${rank}` : `h${rank}`
        break
      }

      case 'End': {
        e.preventDefault()
        // Jump to h-file on current rank
        const rank = currentSquare.value[1]
        currentSquare.value = orientation === 'white' ? `h${rank}` : `a${rank}`
        break
      }

      case 'PageUp': {
        e.preventDefault()
        // Jump to rank 8 on current file
        const file = currentSquare.value[0]
        currentSquare.value = orientation === 'white' ? `${file}8` : `${file}1`
        break
      }

      case 'PageDown': {
        e.preventDefault()
        // Jump to rank 1 on current file
        const file = currentSquare.value[0]
        currentSquare.value = orientation === 'white' ? `${file}1` : `${file}8`
        break
      }

      case 'Enter': {
        e.preventDefault()
        if (keyboardState.value === 'IDLE') {
          if (_isOwnPiece(currentSquare.value)) {
            // Enter PIECE_SELECTED
            const legalDests = getLegalDestinations(deps.getFen(), currentSquare.value)
            selectedSquare.value = currentSquare.value
            keyboardState.value = 'PIECE_SELECTED'
            const piece = getPieceAt(deps.getFen(), currentSquare.value)
            const pieceName = piece ? `${currentSquare.value} 的${PIECE_COLOR_LABELS_ZH[piece.color]}${PIECE_TYPE_LABELS_ZH[piece.type]}` : currentSquare.value
            _announce(`已選取${pieceName}`)
            deps.onPieceSelected(currentSquare.value, legalDests)
          }
        } else {
          // PIECE_SELECTED: commit move if legal destination, or re-select if own piece
          if (_isLegalDest(currentSquare.value) && selectedSquare.value) {
            const from = selectedSquare.value
            const to = currentSquare.value
            selectedSquare.value = null
            keyboardState.value = 'IDLE'
            deps.onSelectionCleared()
            deps.onMoveAttempt(from, to)
          } else if (_isOwnPiece(currentSquare.value)) {
            // Re-select a different own piece
            const legalDests = getLegalDestinations(deps.getFen(), currentSquare.value)
            selectedSquare.value = currentSquare.value
            const piece = getPieceAt(deps.getFen(), currentSquare.value)
            const pieceName = piece ? `${currentSquare.value} 的${PIECE_COLOR_LABELS_ZH[piece.color]}${PIECE_TYPE_LABELS_ZH[piece.type]}` : currentSquare.value
            _announce(`已選取${pieceName}`)
            deps.onPieceSelected(currentSquare.value, legalDests)
          } else {
            // Not a legal destination and not own piece — cancel
            _clearSelection()
          }
        }
        break
      }

      case 'Escape': {
        e.preventDefault()
        _clearSelection()
        break
      }
    }
  }

  function _clearSelection(): void {
    selectedSquare.value = null
    keyboardState.value = 'IDLE'
    deps.onSelectionCleared()
  }

  const currentSquareLabel = computed(() =>
    squareAriaLabel(currentSquare.value, deps.getFen()),
  )

  return {
    currentSquare,
    selectedSquare,
    keyboardState,
    announcement,
    currentSquareLabel,
    handleKeydown,
  }
}
