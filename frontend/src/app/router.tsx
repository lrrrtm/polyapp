import { createBrowserRouter } from 'react-router'
import { HelloPage } from '../pages/hello'
import { RegisterPage } from '../pages/register'
import { RootPage } from '../pages/root'
import { SchedulePage } from '../pages/schedule'
import { SettingsPage } from '../pages/settings'
import { FreshmanPage } from '../pages/freshman'
import { TabsLayout } from '../shared/ui/TabsLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootPage />,
  },
  {
    path: '/hello',
    element: <HelloPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    element: <TabsLayout />,
    children: [
      {
        path: '/freshman',
        element: <FreshmanPage />,
      },
      {
        path: '/schedule',
        element: <SchedulePage />,
      },
      {
        path: '/settings',
        element: <SettingsPage />,
      },
    ],
  },
])
