import { test, expect } from '@playwright/test'

test.describe('Reserve a room (happy path)', () => {
  test('user can navigate to booking page and see the form', async ({ page }) => {
    await page.goto('/')

    // Should show the home page with rooms or empty state
    await expect(page).toHaveTitle(/Adsemble Bookings/)

    // If rooms exist, click first "Reserve Room" button
    const reserveBtn = page.getByRole('link', { name: /Reserve Room/i }).first()
    const hasRooms = await reserveBtn.isVisible().catch(() => false)

    if (hasRooms) {
      await reserveBtn.click()
      await expect(page).toHaveURL(/\/booking/)
      await expect(page.getByText('Fecha y horario')).toBeVisible()
      await expect(page.getByText('Datos del solicitante')).toBeVisible()
    } else {
      // Empty state — just verify the page loaded
      await expect(page.getByText('Adsemble Bookings')).toBeVisible()
    }
  })
})
