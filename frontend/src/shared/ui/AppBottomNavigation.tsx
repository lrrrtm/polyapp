import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import PaymentsIcon from '@mui/icons-material/Payments'
import SchoolIcon from '@mui/icons-material/School'
import SettingsIcon from '@mui/icons-material/Settings'
import AppBar from '@mui/material/AppBar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router'
import { centeredFixedSurfaceSx } from './layout'

const navigationItems = [
  {
    label: 'Поступление',
    value: '/freshman',
    icon: <SchoolIcon />,
  },
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
        ...centeredFixedSurfaceSx,
        top: 'auto',
        bottom: 0,
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
