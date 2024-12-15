import { getQtKey } from '../utils/qtKeyMapper.js';

export class KeyInputManager {
    constructor() {
        this.getQtKey = getQtKey;
    }

    getKeyFromEvent(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (event instanceof MouseEvent) {
            const buttonMap = {
                0: 'LeftButton',
                1: 'MiddleButton',
                2: 'RightButton'
            };
            return `${buttonMap[event.button] || 'Unknown'}`;
        }
        
        if (event instanceof KeyboardEvent) {
            return this.getQtKey(event.code, event.key);
        }

        return null;
    }

    setupKeyListener(input, onKeySet) {
        if (!input) return;
        const handleKeyEvent = (event) => {
            const qtKey = this.getKeyFromEvent(event);
            if (qtKey && onKeySet) {
                onKeySet(qtKey);
                input.blur();
            }
        };

        // Add focus styling
        const handleFocus = () => {
            input.placeholder = 'Press any key...';
            input.value = '';
            input.classList.add('listening');
            
            // Add the mousedown listener when focused
            document.addEventListener('mousedown', handleKeyEvent);
            // Add keyboard event listeners
            input.addEventListener('keyup', handleKeyEvent);
        };

        const handleBlur = () => {
            input.classList.remove('listening');
            
            // Remove event listeners
            document.removeEventListener('mousedown', handleKeyEvent);
            input.removeEventListener('keyup', handleKeyEvent);
        };

        // Set up focus and blur handlers
        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);

        // Prevent default keyboard events
        input.addEventListener('keypress', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        input.addEventListener('keydown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    }
}
