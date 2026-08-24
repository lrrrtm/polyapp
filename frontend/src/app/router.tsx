import { createBrowserRouter, Navigate } from 'react-router'
import { HelloPage } from '../pages/hello'
import { RegisterPage } from '../pages/register'
import { RootPage } from '../pages/root'
import { SchedulePage } from '../pages/schedule'
import { ServicesPage } from '../pages/services'
import { SettingsPage } from '../pages/settings'
import { FreshmanPage } from '../pages/freshman'
import { TabsLayout } from '../shared/ui/TabsLayout'
import { appConfig } from './config'

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
  ...(!appConfig.VITE_ADMISSIONS_ENABLED
    ? [
        {
          path: '/freshman',
          element: <Navigate to="/schedule" replace />,
        },
      ]
    : []),
  {
    element: <TabsLayout />,
    children: [
      ...(appConfig.VITE_ADMISSIONS_ENABLED
        ? [
            {
              path: '/freshman',
              element: <FreshmanPage />,
            },
          ]
        : []),
      {
        path: '/schedule',
        element: <SchedulePage />,
      },
      {
        path: '/services',
        element: <ServicesPage />,
      },
      {
        path: '/settings',
        element: <SettingsPage />,
      },
    ],
  },
])
