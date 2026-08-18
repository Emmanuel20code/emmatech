const fs = require('fs');
const path = 'frontend/src/components/Modals/CheckoutModal.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('onClose: () => void;', 'onClose?: () => void;\n    disableClose?: boolean;');
content = content.replace('onClose, onSuccess', 'onClose, onSuccess, disableClose');
content = content.replace('<button onClick={onClose} disabled={waitingPin}', '{!disableClose && <button onClick={onClose} disabled={waitingPin}');
content = content.replace('<X className="w-5 h-5" />\n                    </button>', '<X className="w-5 h-5" />\n                    </button>}');
fs.writeFileSync(path, content);
