import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter, redirect, useRouteError } from 'react-router'
import './index.css'
import { api } from './api.js'
import Shell from './Shell.jsx'
import { ButtonLink, EmptyState } from './ui.jsx'
import Login from './pages/Login.jsx'
import Overview, { loader as overviewLoader } from './pages/Overview.jsx'
import RoomPlan, { loader as roomPlanLoader } from './pages/RoomPlan.jsx'
import Bookings, { loader as bookingsLoader } from './pages/Bookings.jsx'
import BookingDetail, { loader as bookingDetailLoader } from './pages/BookingDetail.jsx'
import BarSales, { loader as barSalesLoader } from './pages/BarSales.jsx'

// Every loader goes through here, so a missing or expired session leads to login, not an error page (FR-015)
const requireSession = (load) => async (args) => {
  try {
    return await load(args)
  } catch (e) {
    if (e.status !== 401) throw e
    const { pathname, search } = new URL(args.request.url)
    throw redirect('/login?fra=' + encodeURIComponent(pathname + search))
  }
}

function RouteError() {
  const error = useRouteError()
  return (
    <EmptyState
      title="Siden kunne ikke vises."
      body={error?.message}
      action={<ButtonLink to="/bookinger">Tilbage til bookinger</ButtonLink>}
    />
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Shell />,
    errorElement: <RouteError />,
    loader: requireSession(() => api('/auth/me')),
    // Checked once on entry; later 401s are caught by the page loaders, so typing in a filter costs no extra /auth/me
    shouldRevalidate: () => false,
    HydrateFallback: () => null,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, loader: () => redirect('/oversigt') },
          { path: 'oversigt', element: <Overview />, loader: requireSession(overviewLoader) },
          { path: 'belaegningsplan', element: <RoomPlan />, loader: requireSession(roomPlanLoader) },
          { path: 'bookinger', element: <Bookings />, loader: requireSession(bookingsLoader) },
          { path: 'bookinger/:id', element: <BookingDetail />, loader: requireSession(bookingDetailLoader) },
          { path: 'barsalg', element: <BarSales />, loader: requireSession(barSalesLoader) },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
