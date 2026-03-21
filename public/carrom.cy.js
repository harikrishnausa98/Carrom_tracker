describe('Innova Carrom Tracker - E2E Tests', () => {
  
  beforeEach(() => {
    // Assuming the app runs locally on port 3000
    cy.visit('http://localhost:3000'); 
  });

  it('should allow a user to identify themselves and log out', () => {
    // Click Identity button
    cy.get('#identify-btn').click();
    
    // Modal should be visible
    cy.get('#identity-modal').should('have.class', 'visible');
    
    // Enter name and submit
    cy.get('#identity-name').type('John Doe');
    cy.get('#identity-submit').click();
    
    // Verify UI changes
    cy.get('#user-greeting').should('contain', '👤 John Doe').and('be.visible');
    cy.get('#identify-btn').should('contain', 'Logout');
    cy.get('[data-target="new-match"]').should('not.have.class', 'auth-hidden');
    
    // Log out
    cy.get('#identify-btn').click();
    
    // Verify UI reverts
    cy.get('#user-greeting').should('not.be.visible');
    cy.get('#identify-btn').should('contain', '👤 Identify Yourself');
    cy.get('[data-target="new-match"]').should('have.class', 'auth-hidden');
  });

  it('should save a singles match correctly', () => {
    // Pre-requisite: Log in
    cy.window().then((win) => {
      win.localStorage.setItem('innova_carrom_user', 'John Doe');
    });
    cy.reload(); // Apply the state
    
    // Go to New Match
    cy.get('[data-target="new-match"]').click();
    
    // Fill the form
    cy.get('#t1-player1').should('have.value', 'John Doe');
    cy.get('#t2-player1').type('Jane Smith');
    cy.get('#opponent-coins').invoke('val', 5).trigger('input'); // Slide to 5
    
    // Save Match
    cy.get('#match-form button[type="submit"]').click();
    
    // Verify Redirection and Toast Notification
    cy.get('#home-dashboard').should('have.class', 'active');
    cy.get('.undo-toast').should('contain', 'Match saved successfully!');
  });

  it('should handle admin login and data management', () => {
    // Pre-requisite: A match must exist to be deleted/edited.
    // Log in as a user first.
    cy.window().then((win) => {
      win.localStorage.setItem('innova_carrom_user', 'AdminUser');
    });
    cy.reload();

    // Create a match to manage
    cy.get('[data-target="new-match"]').click();
    cy.get('#t2-player1').type('TestPlayer');
    cy.get('#match-form button[type="submit"]').click();
    cy.get('.undo-toast').should('be.visible'); // Wait for match to save

    // Navigate to Admin Panel
    cy.get('[data-target="admin-panel"]').click();

    // Test wrong password
    cy.get('#admin-password').type('wrongpassword');
    cy.get('#admin-login-btn').click();
    cy.get('#admin-error').should('be.visible');

    // Test correct password (from config.json)
    cy.get('#admin-password').clear().type('password123');
    cy.get('#admin-login-btn').click();
    cy.get('#admin-dashboard-card').should('be.visible');

    // Verify the match appears in the admin list
    cy.get('#admin-matches-list').should('contain', 'AdminUser').and('contain', 'TestPlayer');

    // Test editing a match's score
    cy.get('#admin-matches-list button:contains("Edit")').first().click();
    cy.get('#admin-edit-card').should('be.visible');
    cy.get('#edit-winner-score').clear().type('25'); // Change score
    cy.get('#edit-match-form button[type="submit"]').click();
    cy.get('#admin-edit-card').should('not.be.visible');
    
    // Verify the edit by checking the player's high score in their profile
    cy.get('[data-target="player-profiles"]').click();
    cy.get('#player-profiles-body').contains('td', 'AdminUser').parent('tr').within(() => {
        cy.contains('td', '25'); // Check for the new high score
    });

    // Go back to admin to test deleting the match
    cy.get('[data-target="admin-panel"]').click();
    cy.get('#admin-matches-list button:contains("Delete")').first().click();
    // Cypress automatically accepts the confirm() dialog
    cy.get('#admin-matches-list').should('not.contain', 'AdminUser');
  });

  it('should display correct leaderboard and profile stats after several matches', () => {
    // Log in and add a singles match
    cy.window().then(win => win.localStorage.setItem('innova_carrom_user', 'Player A'));
    cy.reload();
    cy.get('[data-target="new-match"]').click();
    cy.get('#t2-player1').type('Player B');
    cy.get('#match-form button[type="submit"]').click();
    cy.get('.undo-toast').should('be.visible');

    // Navigate to Leaderboard and check singles
    cy.get('[data-target="leaderboard"]').click();
    cy.get('.stat-btn[data-stat="singles"]').click();
    cy.get('#leaderboard-body').should('contain', 'Player A');

    // Check H2H (Head-to-Head)
    cy.get('.stat-btn[data-stat="versus"]').click();
    cy.get('#leaderboard-body').should('contain', 'Player A vs Player B').and('contain', '1 - 0');

    // Check Player Profiles
    cy.get('[data-target="player-profiles"]').click();
    cy.get('#player-profiles-body').contains('td', 'Player A').parent('tr').within(() => {
        cy.contains('td', '1'); // Played
        cy.contains('td', '1'); // Won
        cy.contains('td', '100%'); // Win %
    });
  });

  it('should toggle dark mode and persist the setting on reload', () => {
    cy.get('#dark-mode-toggle').click();
    cy.get('body').should('have.class', 'dark-mode');
    cy.get('#dark-mode-toggle').should('contain', '☀️');

    cy.reload(); // Verify persistence
    cy.get('body').should('have.class', 'dark-mode');

    cy.get('#dark-mode-toggle').click();
    cy.get('body').should('not.have.class', 'dark-mode');
  });
});