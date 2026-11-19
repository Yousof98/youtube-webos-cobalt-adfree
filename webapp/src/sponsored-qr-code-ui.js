import { checkboxTools } from './checkboxTools.js';
import { configRead, configWrite } from './config.js';
import { text as languageText } from './languages/index.js';

export function userScriptStartSponsoredQrCodeUI() {
  const uiContainer = document.querySelector('.ytaf-ui-container');
  if (!uiContainer || document.querySelector('#__sponsored_qr_code_block')) {
    return;
  }

  const menuContent =
    uiContainer.querySelector('.ytaf-ui-content') || uiContainer;
  const control = checkboxTools.add(
    '__sponsored_qr_code_block',
    languageText('ui', 'sponsoredQrCodeBlock'),
    configRead('enableSponsoredQrCodeBlock'),
    (newState) => configWrite('enableSponsoredQrCodeBlock', newState)
  );

  const startupControl = document.querySelector('#__startup_page');
  const adblockControl = document.querySelector('#__adblock');
  const anchor =
    (startupControl && startupControl.parentElement) ||
    (adblockControl && adblockControl.parentElement);

  if (anchor && anchor.parentElement === menuContent) {
    menuContent.insertBefore(control, anchor.nextSibling);
  } else {
    menuContent.appendChild(control);
  }
}
