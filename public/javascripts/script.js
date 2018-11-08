let profile;

function onSignIn(googleUser) {
    profile = googleUser.getBasicProfile();
    console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
    console.log('Name: ' + profile.getName());
    console.log('Image URL: ' + profile.getImageUrl());
    console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
    $(".g-signin2").hide();
    $("#profile-pic").attr('src', profile.getImageUrl());
    $("#signoutsection").show();
}

function signOut() {
    let auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('User signed out.');
        profile = null;
        $(".g-signin2").show();
        $("#signoutsection").hide();
    });
}

function getProfile() {
    return profile;
}


$(document).ready(function() {
    $(".delete-admin-button").click(function() {
        const id = $(this).data("admin-id");
        console.log(id);
        //TODO delete admin
    });
})