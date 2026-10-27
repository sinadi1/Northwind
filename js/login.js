/** login.js - sign-in page. */
import { login, ensureDemoUser, DEMO, AuthError } from "./auth.js";
import { getSession, safeNext } from "./session.js";
import { showBanner, clearBanner } from "./ui.js";

const next = safeNext(new URLSearchParams(location.search).get("next"));
if (getSession()) location.replace(next);

const form = document.getElementById("login-form");
const banner = document.getElementById("auth-banner");
const submit = form.querySelector("button[type=submit]");

ensureDemoUser().catch((e) => console.error(e)); // makes the demo account available

document.getElementById("fill-demo").addEventListener("click", () => {
  form.elements.email.value = DEMO.email;
  form.elements.password.value = DEMO.password;
  form.elements.password.focus();
});

form.addEventListener("form:valid", async () => {
  clearBanner(banner);
  submit.disabled = true;
  submit.textContent = "Signing in…";
  try {
    await login({ email: form.elements.email.value, password: form.elements.password.value });
    location.replace(next);
  } catch (error) {
    showBanner(banner, {
      kind: "error",
      message: error instanceof AuthError ? error.message : "Could not sign in. Please try again.",
    });
    form.elements.password.value = "";
    form.elements.password.focus();
    if (!(error instanceof AuthError)) console.error(error);
  } finally {
    submit.disabled = false;
    submit.textContent = "Sign in";
  }
});
