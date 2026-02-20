const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
exports.createNewUser = functions.auth.user().onCreate((user) => {
    const { uid, email } = user;
    return admin.firestore().collection("users").doc(uid).set({
        uid, email, approved: false, role: "employee",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
});
