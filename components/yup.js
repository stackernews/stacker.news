import * as Yup from 'yup';

Yup.addMethod(Yup.string, 'maxStrLen', function maxStrLen(max, errorMessage) {
  return this.test(`test-max-str-len`, (value, { createError, path }) => {
    const length = Array.from(value ?? '').length;
    const valid = length <= max;
    return valid ? true : createError({ message: errorMessage({ max, value: { length } }), path });
  });
});

export default Yup;
