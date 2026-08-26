import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import PaymentsIcon from '@mui/icons-material/Payments'
import SchoolIcon from '@mui/icons-material/School'
import SettingsIcon from '@mui/icons-material/Settings'
import AppBar from '@mui/material/AppBar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router'
import { appConfig } from '../../app/config'
import { vibrateTap } from '../haptics'

const navigationItems = [
  ...(appConfig.VITE_ADMISSIONS_ENABLED
    ? [
        {
          label: 'Поступление',
          value: '/freshman',
          icon: <SchoolIcon />,
        },
      ]
    : []),
  {
    label: 'Расписание',
    value: '/schedule',
    icon: <CalendarMonthIcon />,
  },
  {
    label: 'Сервисы',
    value: '/services',
    icon: <PaymentsIcon />,
  },
  {
    label: 'Настройки',
    value: '/settings',
    icon: <SettingsIcon />,
  },
]

export function AppBottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const currentValue = navigationItems.find((item) => location.pathname.startsWith(item.value))?.value ?? '/schedule'

  return (
    <AppBar
      position="fixed"
      color="default"
      elevation={0}
      sx={{
        top: 'auto',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: theme.zIndex.drawer - 1,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <BottomNavigation
        showLabels
        value={currentValue}
        onChange={(_, value: string) => {
          if (value !== currentValue) {
            vibrateTap()
            navigate(value)
          }
        }}
      >
        {navigationItems.map((item) => (
          <BottomNavigationAction key={item.value} label={item.label} value={item.value} icon={item.icon} />
        ))}
      </BottomNavigation>
    </AppBar>
  )
}
