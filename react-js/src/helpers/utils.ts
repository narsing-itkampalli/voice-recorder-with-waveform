/**
 * Determines if the current browser supports passive event listeners.
 * Passive event listeners are a feature that improves scroll performance by not calling 
 * preventDefault() on the event unless it's explicitly requested.
 * 
 * @returns True if the browser supports passive event listeners, otherwise false.
 */
export function supportsPassiveListeners(): boolean {
    let passiveSupported = false;
    
    try {
        const options = Object.defineProperty({}, 'passive', {
            get: function() {
                passiveSupported = true;
            }
        });
        
        window.addEventListener("testPassive", null as any, options);
        window.removeEventListener("testPassive", null as any, options);
    } catch (e) {}

    return passiveSupported;
}