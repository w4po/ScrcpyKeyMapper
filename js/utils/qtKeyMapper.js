export function getQtKey(code, key, button) {
    // Handle mouse buttons if provided
    if (button !== undefined) {
        switch (button) {
            case 0: return 'LeftButton';
            case 1: return 'MiddleButton';
            case 2: return 'RightButton';
            case 3: return 'ExtraButton1';
            case 4: return 'ExtraButton2';
            default: return `ExtraButton${button - 2}`;
        }
    }

    // Special character mapping when Shift is pressed
    const shiftSymbolMap = {
        '!': 'Key_Exclam',
        '@': 'Key_At',
        '#': 'Key_NumberSign',
        '$': 'Key_Dollar',
        '%': 'Key_Percent',
        '^': 'Key_AsciiCircum',
        '&': 'Key_Ampersand',
        '*': 'Key_Asterisk',
        '(': 'Key_ParenLeft',
        ')': 'Key_ParenRight',
        '_': 'Key_Underscore',
        '+': 'Key_Plus',
        '{': 'Key_BraceLeft',
        '}': 'Key_BraceRight',
        '|': 'Key_Bar',
        ':': 'Key_Colon',
        '"': 'Key_QuoteDbl',
        '<': 'Key_Less',
        '>': 'Key_Greater',
        '?': 'Key_Question',
        '~': 'Key_AsciiTilde'
    };

    // If it's a special character (Shift + key combination)
    if (shiftSymbolMap[key]) {
        return shiftSymbolMap[key];
    }

    const qtKeyMap = {
        // Control Keys
        'ControlLeft': 'Key_Control',
        'ControlRight': 'Key_Control',
        'AltLeft': 'Key_Alt',
        'AltRight': 'Key_Alt',
        'ShiftLeft': 'Key_Shift',
        'ShiftRight': 'Key_Shift',
        'MetaLeft': 'Key_Meta',
        'MetaRight': 'Key_Meta',
        'Tab': 'Key_Tab',
        'CapsLock': 'Key_CapsLock',
        'Space': 'Key_Space',
        'Enter': 'Key_Return',
        'Backspace': 'Key_Backspace',
        'Escape': 'Key_Escape',
        
        // Function Keys
        'F1': 'Key_F1',
        'F2': 'Key_F2',
        'F3': 'Key_F3',
        'F4': 'Key_F4',
        'F5': 'Key_F5',
        'F6': 'Key_F6',
        'F7': 'Key_F7',
        'F8': 'Key_F8',
        'F9': 'Key_F9',
        'F10': 'Key_F10',
        'F11': 'Key_F11',
        'F12': 'Key_F12',

        // Navigation Keys
        'Insert': 'Key_Insert',
        'Delete': 'Key_Delete',
        'Home': 'Key_Home',
        'End': 'Key_End',
        'PageUp': 'Key_PageUp',
        'PageDown': 'Key_PageDown',
        'ArrowLeft': 'Key_Left',
        'ArrowRight': 'Key_Right',
        'ArrowUp': 'Key_Up',
        'ArrowDown': 'Key_Down',

        // Special Characters
        'Backquote': 'Key_QuoteLeft',
        'Minus': 'Key_Minus',
        'Equal': 'Key_Equal',
        'BracketLeft': 'Key_BracketLeft',
        'BracketRight': 'Key_BracketRight',
        'Backslash': 'Key_Backslash',
        'Semicolon': 'Key_Semicolon',
        'Quote': 'Key_Apostrophe',
        'Comma': 'Key_Comma',
        'Period': 'Key_Period',
        'Slash': 'Key_Slash',
    };

    // Handle letters (A-Z)
    if (code.startsWith('Key')) {
        const letter = code.replace('Key', '');
        return `Key_${letter}`;
    }

    // Handle numbers (0-9)
    if (code.startsWith('Digit')) {
        const number = code.replace('Digit', '');
        return `Key_${number}`;
    }

    // Handle Numpad
    if (code.startsWith('Numpad')) {
        const numKey = code.replace('Numpad', '');
        if (!isNaN(numKey)) {
            return `Key_${numKey}`;
        }
        return {
            'Decimal': 'Key_Period',
            'Add': 'Key_Plus',
            'Subtract': 'Key_Minus',
            'Multiply': 'Key_Asterisk',
            'Divide': 'Key_Slash',
            'Enter': 'Key_Enter',
        }[numKey] || code;
    }

    return qtKeyMap[code] || code;
}
