/**
 * Accessible form validation.
 * - Validates on submit using native constraint validation (required, pattern, type, minlength).
 * - Replaces the browser's tooltip with inline messages linked to each
 *   field through aria-describedby, and sets aria-invalid.
 * - Moves focus to the first invalid field and announces a summary.
 * Forms opt in with the data-validate attribute. On success the form fires a
 * bubbling "form:valid" event; data-silent suppresses the default success text.
 */
(function () {
  "use strict";

  function messageFor(field) {
    var v = field.validity;
    var label = field.getAttribute("data-label") || "This field";
    if (v.valueMissing) { return label + " is required."; }
    if (v.typeMismatch) { return "Enter a valid " + label.toLowerCase() + "."; }
    if (v.tooShort) { return label + " must be at least " + field.minLength + " characters."; }
    if (v.patternMismatch) { return field.getAttribute("data-pattern-message") || "Check the format of " + label.toLowerCase() + "."; }
    return field.validationMessage;
  }

  function errorElementFor(field) {
    return document.getElementById(field.id + "-error");
  }

  function showError(field) {
    var el = errorElementFor(field);
    field.setAttribute("aria-invalid", "true");
    if (el) { el.textContent = messageFor(field); }
  }

  function clearError(field) {
    var el = errorElementFor(field);
    field.removeAttribute("aria-invalid");
    if (el) { el.textContent = ""; }
  }

  function fieldsOf(form) {
    return Array.prototype.filter.call(form.elements, function (f) {
      return f.willValidate && f.type !== "radio" && f.type !== "checkbox" && f.type !== "submit" && f.type !== "button";
    });
  }

  document.querySelectorAll("form[data-validate]").forEach(function (form) {
    var status = form.querySelector("[data-form-status]");

    fieldsOf(form).forEach(function (field) {
      // Validate on submit (not on blur): an error message appearing while the
      // pointer is mid-click shifts the layout and can swallow the submit click.
      // Once a field has been flagged, keep its message in sync as the user types.
      field.addEventListener("input", function () {
        if (field.getAttribute("aria-invalid") !== "true") { return; }
        if (field.checkValidity()) { clearError(field); } else { showError(field); }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var invalid = fieldsOf(form).filter(function (f) { return !f.checkValidity(); });

      fieldsOf(form).forEach(clearError);
      invalid.forEach(showError);

      if (invalid.length > 0) {
        if (status) {
          status.className = "form-status error-message";
          status.textContent = invalid.length + (invalid.length === 1 ? " field needs" : " fields need") + " your attention.";
        }
        invalid[0].focus();
        return;
      }

      // Let page scripts handle the valid submission (CRUD, sign-in, ...).
      form.dispatchEvent(new CustomEvent("form:valid", { bubbles: true }));

      if (status) {
        status.className = "form-status";
        status.textContent = form.hasAttribute("data-silent")
          ? ""
          : form.getAttribute("data-success-message") || "Saved successfully.";
      }

      var dialog = form.closest("dialog");
      if (dialog) { form.reset(); dialog.close(); }
    });

    form.addEventListener("reset", function () {
      fieldsOf(form).forEach(clearError);
      if (status) { status.textContent = ""; }
    });
  });
})();
