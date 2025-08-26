
export interface EditorState {
  content: string;
  timestamp: number;
}

export class UndoRedoManager {
  private history: EditorState[] = [];
  private currentIndex = -1;
  private maxHistorySize = 50;
  
  saveState(content: string) {
    const state: EditorState = {
      content,
      timestamp: Date.now()
    };
    
    // Remove any states after current index (when we're in the middle of history)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new state
    this.history.push(state);
    this.currentIndex = this.history.length - 1;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }
  
  canUndo(): boolean {
    return this.currentIndex > 0;
  }
  
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
  
  undo(): string | null {
    if (!this.canUndo()) return null;
    
    this.currentIndex--;
    return this.history[this.currentIndex].content;
  }
  
  redo(): string | null {
    if (!this.canRedo()) return null;
    
    this.currentIndex++;
    return this.history[this.currentIndex].content;
  }
  
  clear() {
    this.history = [];
    this.currentIndex = -1;
  }
}
