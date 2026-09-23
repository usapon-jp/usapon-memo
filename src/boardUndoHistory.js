export const BOARD_UNDO_LIMIT = 20;

export const emptyBoardUndoHistory = () => ({ past: [], future: [] });

export const captureBoardUndo = (history, label, data) => ({
  past: [...history.past, { label, data }].slice(-BOARD_UNDO_LIMIT),
  future: []
});

export const undoBoardAction = (history, currentData) => {
  const action = history.past.at(-1);
  if (!action) return null;
  return {
    data: action.data,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, { label: action.label, data: currentData }]
    }
  };
};

export const redoBoardAction = (history, currentData) => {
  const action = history.future.at(-1);
  if (!action) return null;
  return {
    data: action.data,
    history: {
      past: [...history.past, { label: action.label, data: currentData }],
      future: history.future.slice(0, -1)
    }
  };
};
