/**
 * Atomic Components Index
 * Barrel export for all atomic UI components
 */

// Core form components
export { default as Button } from './Button.svelte';
export { default as Input } from './Input.svelte';
export { default as Label } from './Label.svelte';
export { default as Checkbox } from './Checkbox.svelte';
export { default as Radio } from './Radio.svelte';
export { default as Select } from './Select.svelte';
export { default as Slider } from './Slider.svelte';
export { default as Toggle } from './Toggle.svelte';
export { default as StatusIndicator } from './StatusIndicator.svelte';

// Display components
export { default as Badge } from './Badge.svelte';
export { default as Icon } from './Icon.svelte';
export { default as SymbolBadge } from './SymbolBadge.svelte';

// Component metadata for documentation and tools
export const atomicComponents = {
  Button: {
    name: 'Button',
    description: 'A versatile button component with multiple variants and sizes',
    props: [
      'variant', 'size', 'disabled', 'loading', 'fullWidth', 'leftIcon', 'rightIcon',
      'href', 'target', 'type', 'ariaLabel', 'ariaDescribedBy'
    ],
    variants: ['default', 'primary', 'secondary', 'success', 'warning', 'danger', 'info', 'ghost', 'link'],
    sizes: ['xs', 'sm', 'md', 'lg', 'xl']
  },
  Input: {
    name: 'Input',
    description: 'A versatile input component with validation states and accessibility features',
    props: [
      'type', 'size', 'value', 'placeholder', 'disabled', 'readonly', 'required',
      'invalid', 'valid', 'errorMessage', 'helperText', 'label', 'id', 'name',
      'maxlength', 'minlength', 'min', 'max', 'step', 'pattern', 'autocomplete',
      'autoFocus', 'fullWidth', 'leftIcon', 'rightIcon', 'loading'
    ],
    types: ['text', 'password', 'email', 'number', 'tel', 'url', 'search'],
    sizes: ['sm', 'md', 'lg']
  },
  Label: {
    name: 'Label',
    description: 'A versatile label component for form elements and general labeling',
    props: ['htmlFor', 'size', 'weight', 'required', 'disabled', 'invalid', 'fullWidth', 'srOnly', 'as', 'id'],
    sizes: ['xs', 'sm', 'md', 'lg'],
    weights: ['normal', 'medium', 'semibold', 'bold']
  },
  Badge: {
    name: 'Badge',
    description: 'A versatile badge component for status indicators, counts, and labels',
    props: [
      'variant', 'size', 'shape', 'dot', 'count', 'max', 'showZero', 'removable',
      'href', 'target', 'ariaLabel', 'id'
    ],
    variants: ['default', 'primary', 'secondary', 'success', 'warning', 'danger', 'info'],
    sizes: ['xs', 'sm', 'md', 'lg'],
    shapes: ['rounded', 'square', 'pill']
  },
  Icon: {
    name: 'Icon',
    description: 'A versatile icon component with loading states and accessibility features',
    props: [
      'name', 'size', 'variant', 'loading', 'clickable', 'rotation', 'flip',
      'label', 'title', 'ariaHidden', 'id'
    ],
    variants: ['default', 'muted', 'primary', 'secondary', 'success', 'warning', 'danger', 'info'],
    sizes: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']
  },
  Checkbox: {
    name: 'Checkbox',
    description: 'A versatile checkbox component with multiple states and accessibility features',
    props: [
      'checked', 'indeterminate', 'disabled', 'readonly', 'required', 'size', 'variant',
      'label', 'helperText', 'errorMessage', 'id', 'name', 'value', 'ariaLabel', 'ariaDescribedBy'
    ],
    variants: ['default', 'primary', 'secondary', 'success', 'warning', 'danger'],
    sizes: ['sm', 'md', 'lg']
  },
  Radio: {
    name: 'Radio',
    description: 'A versatile radio button component with accessibility features',
    props: [
      'group', 'disabled', 'readonly', 'required', 'size', 'variant', 'label',
      'helperText', 'errorMessage', 'id', 'name', 'value', 'ariaLabel', 'ariaDescribedBy'
    ],
    variants: ['default', 'primary', 'secondary', 'success', 'warning', 'danger'],
    sizes: ['sm', 'md', 'lg']
  },
  Slider: {
    name: 'Slider',
    description: 'A versatile range slider component with accessibility features',
    props: [
      'value', 'min', 'max', 'step', 'disabled', 'readonly', 'required', 'size', 'variant',
      'label', 'helperText', 'errorMessage', 'showValue', 'showTicks', 'showLabels',
      'orientation', 'id', 'name', 'ariaLabel', 'ariaDescribedBy'
    ],
    variants: ['default', 'primary', 'secondary', 'success', 'warning', 'danger'],
    sizes: ['sm', 'md', 'lg'],
    orientations: ['horizontal', 'vertical']
  }
};

// Component groups for organized imports
export const formComponents = {
  Input,
  Label,
  Checkbox,
  Radio,
  Slider,
  Button
};

export const displayComponents = {
  Badge,
  Icon,
  Button
};

export const interactiveComponents = {
  Button,
  Checkbox,
  Radio,
  Slider,
  Icon
};

// Default export with all components
export default {
  ...formComponents,
  ...displayComponents,
  ...interactiveComponents,
  atomicComponents,
  formComponents,
  displayComponents,
  interactiveComponents
};
