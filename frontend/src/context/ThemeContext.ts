import { createContext, useContext } from 'react'
import { TK } from '../theme'

export const ThemeContext = createContext<typeof TK>(TK)
export const useTheme = () => useContext(ThemeContext)
