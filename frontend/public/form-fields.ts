/** Use the native getter: a control named "elements" can shadow form.elements. */
export function formControls(form: HTMLFormElement): HTMLFormControlsCollection {
  return Reflect.get(HTMLFormElement.prototype, 'elements', form) as HTMLFormControlsCollection;
}
