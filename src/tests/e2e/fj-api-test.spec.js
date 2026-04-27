import { test, expect } from '@playwright/test';

test('FJWidgets API investigation', async ({ page }) => {
  await page.goto('about:blank');

  // Load the script directly
  await page.addScriptTag({ url: 'https://feed.financialjuice.com/widgets/widgets.js' });
  await page.waitForTimeout(2000);

  const apiInfo = await page.evaluate(() => {
    const result = {
      FJWidgets_exists: typeof FJWidgets !== 'undefined',
      FJWidgets_type: typeof FJWidgets,
      FJWidgets_keys: FJWidgets ? Object.keys(FJWidgets) : [],
      FJWidgets_prototype_keys: FJWidgets ? Object.getOwnPropertyNames(Object.getPrototypeOf(FJWidgets)) : [],
    };

    // Try calling createWidget with various approaches
    const container = document.createElement('div');
    container.id = 'fj-test';
    document.body.appendChild(container);

    if (FJWidgets && FJWidgets.createWidget) {
      try {
        FJWidgets.createWidget({
          container: container,
          mode: 'Dark',
          width: 500,
          height: 600,
          backColor: '1e222d',
          fontColor: 'b2b5be',
          widgetType: 'NEWS'
        });
        result.createWidget_return = 'no error';
      } catch (e) {
        result.createWidget_error = e.message;
      }
    }

    // Wait and check
    return new Promise(resolve => {
      setTimeout(() => {
        result.container_innerHTML_length = container.innerHTML.length;
        result.container_innerHTML_preview = container.innerHTML.substring(0, 2000);
        result.container_childCount = container.childElementCount;
        result.container_children = Array.from(container.children).map(c => ({
          tag: c.tagName, id: c.id, className: c.className?.substring(0, 100),
          src: c.src || ''
        }));
        resolve(result);
      }, 3000);
    });
  });

  console.log(JSON.stringify(apiInfo, null, 2));
});
