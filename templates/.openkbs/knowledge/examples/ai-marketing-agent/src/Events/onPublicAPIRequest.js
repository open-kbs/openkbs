const handler = async ({ payload }) => {
    const { item, attributes, itemType, action } = payload;

    if (action === 'createItem') {
        const myItem = {};

        myItem.contry = openkbs.clientHeaders['cloudfront-viewer-country-name']
        myItem.ip = openkbs.clientHeaders['x-forwarded-for']

        for (const attribute of attributes) {
            const { attrName, encrypted } = attribute;
            if (encrypted && item[attrName] !== undefined) {
                myItem[attrName] = await openkbs.encrypt(item[attrName]);
            } else {
                myItem[attrName] = item[attrName];
            }
        }

        return await openkbs.items({ action, itemType, attributes, item: myItem });
    }
}

module.exports = { handler }