import { test, expect } from '@playwright/test';

async function entrar(page, usuario, clave) {
  await page.goto('/');
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

// Suite rápida (@smoke): lo mínimo para saber que la aplicación sirve
test('la portada carga', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Panel de pedidos' })).toBeVisible();
});

test('ana inicia sesión', { tag: '@smoke' }, async ({ page }) => {
  await entrar(page, 'ana', 'secreta');
  await expect(page.getByRole('alert')).toHaveText('Bienvenida, ana');
});

// Resto de la suite completa
test('una contraseña incorrecta no deja entrar', async ({ page }) => {
  await entrar(page, 'ana', 'otra');
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos');
  await expect(page.getByRole('button', { name: 'Informe mensual' })).toBeHidden();
});

test('un usuario desconocido no deja entrar', async ({ page }) => {
  await entrar(page, 'luis', 'secreta');
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos');
});

test('genera el informe mensual', async ({ page }) => {
  await entrar(page, 'ana', 'secreta');
  await page.getByRole('button', { name: 'Informe mensual' }).click();
  await expect(page.getByRole('status')).toHaveText('Informe mensual: 42 pedidos');
});

test('genera el informe anual', async ({ page }) => {
  await entrar(page, 'ana', 'secreta');
  await page.getByRole('button', { name: 'Informe anual' }).click();
  await expect(page.getByRole('status')).toHaveText('Informe anual: 517 pedidos');
});
