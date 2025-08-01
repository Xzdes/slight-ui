// Файл: core/create-app.js

const { normalize } = require('./vdom/normalize.js');
const { mount } = require('./renderer/mount.js');
const { patch } = require('./renderer/patch.js');
const { resolveProps } = require('./vdom/props-resolver.js');
const { stateContainer, setBreakpoints, initScreenState, setMainRenderEffect } = require('./state-manager.js');

function createRender(reactiveFns) { 
    return function render(viewFn, targetElement, config = {}) { 
        initScreenState(reactiveFns.createReactive); 
        if (config.breakpoints) {
            setBreakpoints(config.breakpoints);
        }
        
        let oldVNode = null; 
        
        const renderEffect = () => { 
            // Мы читаем свойство, чтобы этот эффект подписался на его изменения
            // Это "костыль", но он гарантирует, что ресайз окна будет вызывать реактивность
            const _breakpoint = stateContainer.screenState.breakpoint;

            let newVNode = normalize(viewFn());
            
            function traverseAndResolve(vnode) {
                if (!vnode) return;
                if (!vnode._internal) vnode._internal = { vnode };
                const rawProps = { ...vnode.props };
                 if (rawProps.model && Array.isArray(rawProps.model)) {
                    const [stateObject, propertyName] = rawProps.model;
                    const isCheckbox = typeof stateObject[propertyName] === 'boolean';
                    if (isCheckbox) {
                        rawProps.type = 'checkbox'; rawProps.checked = stateObject[propertyName];
                        rawProps.onchange = e => stateObject[propertyName] = e.target.checked;
                    } else {
                        if (!rawProps.type) { rawProps.type = 'text'; }
                        rawProps.value = stateObject[propertyName];
                        rawProps.oninput = e => stateObject[propertyName] = e.target.value;
                    }
                }
                vnode.resolvedProps = resolveProps(rawProps, stateContainer, vnode._internal.state || {});
                const children = vnode.resolvedProps.children || vnode.children;
                if (children && children.length > 0) {
                    children.forEach(traverseAndResolve);
                }
            }
            traverseAndResolve(newVNode);
            
            if (!oldVNode) { 
                targetElement.innerHTML = ''; 
                mount(newVNode, targetElement); 
            } else { 
                patch(oldVNode, newVNode); 
            } 
            oldVNode = newVNode; 
        };
        
        // [ИЗМЕНЕНИЕ] Сохраняем "умную" обертку, которую возвращает createEffect
        const effectRunner = reactiveFns.createEffect(renderEffect);

        // [ИЗМЕНЕНИЕ] Регистрируем в state-manager именно "умную" обертку!
        setMainRenderEffect(effectRunner);
    }; 
}

module.exports = { createRender };