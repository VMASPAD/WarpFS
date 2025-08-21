import React, { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  created: Date;
  modified: Date;
  parent?: string;
  path: string;
  extension?: string;
  isPublic?: boolean;
}

export interface FileSystemState {
  currentPath: string;
  items: FileItem[];
  selectedItems: string[];
  loading: boolean;
  error: string | null;
  user: {
    id: string;
    user: string;
  } | null;
}

type FileSystemAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ITEMS'; payload: FileItem[] }
  | { type: 'SET_CURRENT_PATH'; payload: string }
  | { type: 'ADD_ITEM'; payload: FileItem }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: FileItem }
  | { type: 'SET_SELECTED_ITEMS'; payload: string[] }
  | { type: 'TOGGLE_ITEM_SELECTION'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_USER'; payload: { id: string; user: string } | null };

const initialState: FileSystemState = {
  currentPath: '/',
  items: [],
  selectedItems: [],
  loading: false,
  error: null,
  user: null,
};

function fileSystemReducer(state: FileSystemState, action: FileSystemAction): FileSystemState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_ITEMS':
      return { ...state, items: action.payload, loading: false };
    case 'SET_CURRENT_PATH':
      return { ...state, currentPath: action.payload, selectedItems: [] };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'DELETE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
        selectedItems: state.selectedItems.filter(id => id !== action.payload),
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'SET_SELECTED_ITEMS':
      return { ...state, selectedItems: action.payload };
    case 'TOGGLE_ITEM_SELECTION':
      return {
        ...state,
        selectedItems: state.selectedItems.includes(action.payload)
          ? state.selectedItems.filter(id => id !== action.payload)
          : [...state.selectedItems, action.payload],
      };
    case 'CLEAR_SELECTION':
      return { ...state, selectedItems: [] };
    case 'SET_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

const FileSystemContext = createContext<{
  state: FileSystemState;
  dispatch: React.Dispatch<FileSystemAction>;
} | undefined>(undefined);

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fileSystemReducer, initialState);

  return (
    <FileSystemContext.Provider value={{ state, dispatch }}>
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (context === undefined) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
}