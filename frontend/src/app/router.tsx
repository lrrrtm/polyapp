import { createBrowserRouter, Navigate } from 'react-router'
import { TabsLayout } from '../shared/ui/TabsLayout'
import { appConfig } from './config'
import { LazyRoute } from './LazyRoute'
import { lazyPage } from './lazyPage'

const FreshmanPage = lazyPage(() => import('../pages/freshman'), 'FreshmanPage')
const HelloPage = lazyPage(() => import('../pages/hello'), 'HelloPage')
const RegisterPage = lazyPage(() => import('../pages/register'), 'RegisterPage')
const RootPage = lazyPage(() => import('../pages/root'), 'RootPage')
const SchedulePage = lazyPage(() => import('../pages/schedule'), 'SchedulePage')
const ServicesPage = lazyPage(() => import('../pages/services'), 'ServicesPage')
const SettingsPage = lazyPage(() => import('../pages/settings'), 'SettingsPage')

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LazyRoute component={RootPage} />,
  },
  {
    path: '/hello',
    element: <LazyRoute component={HelloPage} />,
  },
  {
    path: '/register',
    element: <LazyRoute component={RegisterPage} />,
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
              element: <LazyRoute component={FreshmanPage} />,
            },
          ]
        : []),
      {
        path: '/schedule',
        element: <LazyRoute component={SchedulePage} />,
      },
      {
        path: '/services',
        element: <LazyRoute component={ServicesPage} />,
      },
      {
        path: '/settings',
        element: <LazyRoute component={SettingsPage} />,
      },
    ],
  },
])
