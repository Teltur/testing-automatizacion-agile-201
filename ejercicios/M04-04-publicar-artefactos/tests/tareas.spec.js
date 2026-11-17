import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('empieza sin tareas', async ({ page }) => {
  await expect(page.getByRole('list', { name: 'Tareas' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('#contador')).toHaveText('0 tareas');
});

test('añade una tarea', async ({ page }) => {
  await page.getByLabel('Nueva tarea').fill('Comprar pan');
  await page.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.getByRole('listitem')).toHaveText(['Comprar pan']);
  await expect(page.locator('#contador')).toHaveText('1 tarea');
});

test('añade dos tareas en orden', async ({ page }) => {
  for (const tarea of ['Comprar pan', 'Llamar al taller']) {
    await page.getByLabel('Nueva tarea').fill(tarea);
    await page.getByRole('button', { name: 'Añadir' }).click();
  }
  await expect(page.getByRole('listitem')).toHaveText(['Comprar pan', 'Llamar al taller']);
  await expect(page.locator('#contador')).toHaveText('3 tareas');
});
