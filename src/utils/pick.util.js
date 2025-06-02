// src/utils/pick.util.js

/**
 * Creates an object composed of the picked object properties.
 * @param {object} object - The source object.
 * @param {string[]} keys - The properties to pick.
 * @returns {object} - Returns the new object.
 */
const pick = (object, keys) => {
    return keys.reduce((obj, key) => {
        if (object && Object.prototype.hasOwnProperty.call(object, key)) {
            // eslint-disable-next-line no-param-reassign
            obj[key] = object[key];
        }
        return obj;
    }, {});
};

export default pick;

// Example usage:
// import pick from '../utils/pick.util.js';
//
// const object = { a: 1, b: '2', c: true, d: 'extra' };
// const pickedObject = pick(object, ['a', 'c']);
// console.log(pickedObject); // Output: { a: 1, c: true }