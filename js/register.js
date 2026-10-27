/** register.js - create-account page. */
import { register, AuthError } from "./auth.js";
import { getSession } from "./session.js";
import { showBanner, clearBanner } from "./ui.js";

if (getSession()) location.replace("index.html");

const form = document.getElementById("register-form");
const banner = document.getElementById("auth-banner");
const submit = form.querySelector("button[type=submit]");
const { password, confirm } = form.elements;

// Native validation cannot compare two fields, so keep a custom message in sync.
// Capture phase: runs before the shared validator re-checks the field.
function syncConfirm() {
  confirm.setCustomValidity(confirm.value !== password.value ? "Passwords do not match." : "");
}
form.addEventListener("input", syncConfirm, true);

form.addEventListener("form:valid", async () => {
  clearBanner(banner);
  submit.disabled = true;
  submit.textContent = "Creating account…";
  try {
    await register({
      name: form.elements.name.value,
      email: form.elements.email.value,
      password: password.value,
    });
    location.replace("index.html");
  } catch (error) {
    showBanner(banner, {
      kind: "error",
      message: error instanceof AuthError ? error.message : "Could not create the account. Please try again.",
    });
    if (!(error instanceof AuthError)) console.error(error);
  } finally {
    submit.disabled = false;
    submit.textContent = "Create account";
  }
});
