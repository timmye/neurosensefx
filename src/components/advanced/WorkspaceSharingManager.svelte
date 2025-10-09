<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../stores/workspaceStore.js';
  import { Button } from '../atoms/Button.svelte';
  import { Modal } from '../organisms/Modal.svelte';
  import { FormField } from '../molecules/FormField.svelte';
  import { Input } from '../atoms/Input.svelte';
  import { Select } from '../atoms/Select.svelte';
  import { Badge } from '../atoms/Badge.svelte';
  import { Icon } from '../atoms/Icon.svelte';
  import { Toggle } from '../atoms/Toggle.svelte';
  
  const dispatch = createEventDispatcher();
  
  let sharedWorkspaces = [];
  let showShareModal = false;
  let showCollaborateModal = false;
  let selectedWorkspace = null;
  let shareLink = '';
  let collaborators = [];
  let pendingInvites = [];
  
  // Form data for sharing
  let shareFormData = {
    workspaceId: '',
    permissions: 'view', // view, edit, admin
    expiresAt: null,
    allowComments: true,
    allowDownload: false,
    password: '',
    maxUsers: 5
  };
  
  // Form data for collaboration
  let collaborateFormData = {
    email: '',
    role: 'viewer', // viewer, editor, admin
    message: ''
  };
  
  // Permission levels
  const permissionLevels = [
    { value: 'view', label: 'View Only', description: 'Can view workspace only' },
    { value: 'edit', label: 'Edit', description: 'Can view and edit workspace' },
    { value: 'admin', label: 'Admin', description: 'Full control over workspace' }
  ];
  
  // Collaboration roles
  const collaborationRoles = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'editor', label: 'Editor' },
    { value: 'admin', label: 'Admin' }
  ];
  
  onMount(() => {
    loadSharedWorkspaces();
    loadCollaborators();
  });
  
  function loadSharedWorkspaces() {
    const shared = localStorage.getItem('neurosense_shared_workspaces');
    if (shared) {
      try {
        sharedWorkspaces = JSON.parse(shared);
      } catch (error) {
        console.error('Failed to load shared workspaces:', error);
        sharedWorkspaces = [];
      }
    }
  }
  
  function saveSharedWorkspaces() {
    localStorage.setItem('neurosense_shared_workspaces', JSON.stringify(sharedWorkspaces));
  }
  
  function loadCollaborators() {
    const collabs = localStorage.getItem('neurosense_collaborators');
    if (collabs) {
      try {
        collaborators = JSON.parse(collabs);
      } catch (error) {
        console.error('Failed to load collaborators:', error);
        collaborators = [];
      }
    }
    
    const pending = localStorage.getItem('neurosense_pending_invites');
    if (pending) {
      try {
        pendingInvites = JSON.parse(pending);
      } catch (error) {
        console.error('Failed to load pending invites:', error);
        pendingInvites = [];
      }
    }
  }
  
  function saveCollaborators() {
    localStorage.setItem('neurosense_collaborators', JSON.stringify(collaborators));
    localStorage.setItem('neurosense_pending_invites', JSON.stringify(pendingInvites));
  }
  
  function openShareModal(workspace) {
    selectedWorkspace = workspace;
    shareFormData = {
      workspaceId: workspace.id,
      permissions: 'view',
      expiresAt: null,
      allowComments: true,
      allowDownload: false,
      password: '',
      maxUsers: 5
    };
    showShareModal = true;
  }
  
  function openCollaborateModal(workspace) {
    selectedWorkspace = workspace;
    collaborateFormData = {
      email: '',
      role: 'viewer',
      message: ''
    };
    showCollaborateModal = true;
  }
  
  function generateShareLink() {
    const shareData = {
      workspaceId: shareFormData.workspaceId,
      permissions: shareFormData.permissions,
      expiresAt: shareFormData.expiresAt,
      allowComments: shareFormData.allowComments,
      allowDownload: shareFormData.allowDownload,
      password: shareFormData.password,
      maxUsers: shareFormData.maxUsers,
      createdAt: new Date().toISOString(),
      shareId: `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Create shareable link
    const baseUrl = window.location.origin;
    shareLink = `${baseUrl}/shared/${shareData.shareId}`;
    
    // Save share data
    const existingShare = sharedWorkspaces.find(s => s.workspaceId === shareFormData.workspaceId);
    if (existingShare) {
      Object.assign(existingShare, shareData);
    } else {
      sharedWorkspaces.push(shareData);
    }
    
    saveSharedWorkspaces();
    
    // Add to workspace store
    if (selectedWorkspace) {
      workspaceStore.updateWorkspace(selectedWorkspace.id, {
        shared: true,
        shareSettings: shareData
      });
    }
    
    dispatch('workspaceShared', shareData);
  }
  
  function copyShareLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      dispatch('shareLinkCopied');
    });
  }
  
  function inviteCollaborator() {
    if (!collaborateFormData.email.trim()) return;
    
    const invite = {
      id: `invite_${Date.now()}`,
      workspaceId: selectedWorkspace.id,
      email: collaborateFormData.email,
      role: collaborateFormData.role,
      message: collaborateFormData.message,
      status: 'pending',
      createdAt: new Date(),
      invitedBy: 'current-user' // Would be actual user ID
    };
    
    pendingInvites.push(invite);
    saveCollaborators();
    
    // Simulate sending invite (in real app, this would be an API call)
    setTimeout(() => {
      const index = pendingInvites.findIndex(i => i.id === invite.id);
      if (index !== -1) {
        pendingInvites.splice(index, 1);
        
        // Add to collaborators as accepted
        collaborators.push({
          id: `collab_${Date.now()}`,
          workspaceId: selectedWorkspace.id,
          email: collaborateFormData.email,
          role: collaborateFormData.role,
          status: 'active',
          joinedAt: new Date(),
          lastActive: new Date()
        });
        
        saveCollaborators();
        dispatch('collaboratorAdded', { email: collaborateFormData.email, role: collaborateFormData.role });
      }
    }, 2000);
    
    // Reset form
    collaborateFormData = {
      email: '',
      role: 'viewer',
      message: ''
    };
    
    showCollaborateModal = false;
  }
  
  function removeCollaborator(collaboratorId) {
    if (!confirm('Remove this collaborator?')) return;
    
    collaborators = collaborators.filter(c => c.id !== collaboratorId);
    saveCollaborators();
    dispatch('collaboratorRemoved', collaboratorId);
  }
  
  function updateCollaboratorRole(collaboratorId, newRole) {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    if (collaborator) {
      collaborator.role = newRole;
      collaborator.lastActive = new Date();
      saveCollaborators();
      dispatch('collaboratorUpdated', { id: collaboratorId, role: newRole });
    }
  }
  
  function revokeShare(shareId) {
    if (!confirm('Revoke sharing access?')) return;
    
    sharedWorkspaces = sharedWorkspaces.filter(s => s.shareId !== shareId);
    saveSharedWorkspaces();
    
    const workspace = sharedWorkspaces.find(s => s.shareId === shareId);
    if (workspace && workspace.workspaceId) {
      workspaceStore.updateWorkspace(workspace.workspaceId, { shared: false });
    }
    
    dispatch('shareRevoked', shareId);
  }
  
  function getShareStatus(share) {
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return 'expired';
    }
    return 'active';
  }
  
  function getPermissionBadgeVariant(permission) {
    switch (permission) {
      case 'view': return 'secondary';
      case 'edit': return 'primary';
      case 'admin': return 'warning';
      default: return 'outline';
    }
  }
  
  function getRoleBadgeVariant(role) {
    switch (role) {
      case 'viewer': return 'secondary';
      case 'editor': return 'primary';
      case 'admin': return 'warning';
      default: return 'outline';
    }
  }
</script>

<div class="workspace-sharing-manager">
  <div class="sharing-header">
    <h2>Workspace Sharing & Collaboration</h2>
    <p class="sharing-description">Share your workspaces with others and collaborate in real-time</p>
  </div>
  
  <div class="sharing-content">
    <div class="sharing-section">
      <h3>Shared Workspaces</h3>
      <div class="shared-workspaces">
        {#each sharedWorkspaces as share}
          <div class="share-item">
            <div class="share-info">
              <div class="share-title">
                <strong>Shared Workspace</strong>
                <Badge variant={getPermissionBadgeVariant(share.permissions)}>
                  {share.permissions}
                </Badge>
                <Badge variant={getShareStatus(share) === 'active' ? 'success' : 'secondary'}>
                  {getShareStatus(share)}
                </Badge>
              </div>
              <div class="share-meta">
                <span class="share-link">{share.shareId}</span>
                <span class="share-date">
                  Shared {new Date(share.createdAt).toLocaleDateString()}
                </span>
                {share.expiresAt && (
                  <span class="share-expiry">
                    Expires {new Date(share.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div class="share-stats">
                <span class="stat">
                  <Icon name="users" size="sm" />
                  {share.maxUsers || '∞'} users
                </span>
                <span class="stat">
                  <Icon name="message-circle" size="sm" />
                  {share.allowComments ? 'Comments enabled' : 'Comments disabled'}
                </span>
                <span class="stat">
                  <Icon name="download" size="sm" />
                  {share.allowDownload ? 'Download enabled' : 'Download disabled'}
                </span>
              </div>
            </div>
            <div class="share-actions">
              <Button size="sm" variant="ghost" onClick={() => {
                shareLink = `${window.location.origin}/shared/${share.shareId}`;
                copyShareLink();
              }}>
                <Icon name="copy" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => revokeShare(share.shareId)}>
                <Icon name="x" />
              </Button>
            </div>
          </div>
        {/each}
        
        {#if sharedWorkspaces.length === 0}
          <div class="empty-state">
            <Icon name="share-2" size="lg" />
            <p>No shared workspaces yet</p>
            <p class="empty-description">Share a workspace to collaborate with others</p>
          </div>
        {/if}
      </div>
    </div>
    
    <div class="collaboration-section">
      <h3>Active Collaborators</h3>
      <div class="collaborators-list">
        {#each collaborators as collaborator}
          <div class="collaborator-item">
            <div class="collaborator-info">
              <div class="collaborator-name">
                <strong>{collaborator.email}</strong>
                <Badge variant={getRoleBadgeVariant(collaborator.role)}>
                  {collaborator.role}
                </Badge>
                <Badge variant="secondary" size="sm">
                  {collaborator.status}
                </Badge>
              </div>
              <div class="collaborator-meta">
                <span>Joined {new Date(collaborator.joinedAt).toLocaleDateString()}</span>
                <span>Last active {new Date(collaborator.lastActive).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="collaborator-actions">
              <Select
                options={collaborationRoles}
                bind:value={collaborator.role}
                size="sm"
                onChange={() => updateCollaboratorRole(collaborator.id, collaborator.role)}
              />
              <Button size="sm" variant="ghost" onClick={() => removeCollaborator(collaborator.id)}>
                <Icon name="user-x" />
              </Button>
            </div>
          </div>
        {/each}
        
        {#each pendingInvites as invite}
          <div class="collaborator-item pending">
            <div class="collaborator-info">
              <div class="collaborator-name">
                <strong>{invite.email}</strong>
                <Badge variant="outline" size="sm">Pending</Badge>
                <Badge variant={getRoleBadgeVariant(invite.role)}>
                  {invite.role}
                </Badge>
              </div>
              <div class="collaborator-meta">
                <span>Invited {new Date(invite.createdAt).toLocaleDateString()}</span>
                <span>Awaiting response</span>
              </div>
            </div>
            <div class="collaborator-actions">
              <Button size="sm" variant="ghost" disabled>
                <Icon name="clock" />
              </Button>
            </div>
          </div>
        {/each}
        
        {#if collaborators.length === 0 && pendingInvites.length === 0}
          <div class="empty-state">
            <Icon name="users" size="lg" />
            <p>No collaborators yet</p>
            <p class="empty-description">Invite team members to collaborate on workspaces</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Share Workspace Modal -->
  <Modal bind:open={showShareModal} title="Share Workspace">
    <div class="share-form">
      <FormField label="Permission Level">
        <Select
          options={permissionLevels}
          bind:value={shareFormData.permissions}
        />
        <p class="field-description">
          {permissionLevels.find(p => p.value === shareFormData.permissions)?.description}
        </p>
      </FormField>
      
      <FormField label="Maximum Users">
        <Input
          type="number"
          bind:value={shareFormData.maxUsers}
          min="1"
          max="50"
          placeholder="5"
        />
      </FormField>
      
      <FormField label="Expiration (Optional)">
        <Input
          type="datetime-local"
          bind:value={shareFormData.expiresAt}
        />
      </FormField>
      
      <FormField label="Password (Optional)">
        <Input
          type="password"
          bind:value={shareFormData.password}
          placeholder="Leave empty for no password"
        />
      </FormField>
      
      <FormField label="Allow Comments">
        <Toggle bind:checked={shareFormData.allowComments} />
      </FormField>
      
      <FormField label="Allow Download">
        <Toggle bind:checked={shareFormData.allowDownload} />
      </FormField>
      
      <div class="form-actions">
        <Button variant="outline" onClick={() => showShareModal = false}>
          Cancel
        </Button>
        <Button onClick={generateShareLink}>
          Generate Share Link
        </Button>
      </div>
      
      {#if shareLink}
        <div class="share-link-display">
          <FormField label="Share Link">
            <div class="link-container">
              <Input value={shareLink} readonly />
              <Button size="sm" onClick={copyShareLink}>
                <Icon name="copy" />
                Copy
              </Button>
            </div>
          </FormField>
        </div>
      {/if}
    </div>
  </Modal>
  
  <!-- Invite Collaborator Modal -->
  <Modal bind:open={showCollaborateModal} title="Invite Collaborator">
    <div class="invite-form">
      <FormField label="Email Address" required>
        <Input
          type="email"
          bind:value={collaborateFormData.email}
          placeholder="colleague@example.com"
        />
      </FormField>
      
      <FormField label="Role">
        <Select
          options={collaborationRoles}
          bind:value={collaborateFormData.role}
        />
      </FormField>
      
      <FormField label="Personal Message (Optional)">
        <Input
          bind:value={collaborateFormData.message}
          placeholder="Join my workspace to collaborate on trading strategies"
        />
      </FormField>
      
      <div class="form-actions">
        <Button variant="outline" onClick={() => showCollaborateModal = false}>
          Cancel
        </Button>
        <Button 
          onClick={inviteCollaborator} 
          disabled={!collaborateFormData.email.trim()}
        >
          Send Invitation
        </Button>
      </div>
    </div>
  </Modal>
</div>

<style>
  .workspace-sharing-manager {
    padding: var(--space-6);
  }
  
  .sharing-header {
    margin-bottom: var(--space-6);
  }
  
  .sharing-header h2 {
    margin: 0 0 var(--space-2) 0;
    color: var(--text-primary);
  }
  
  .sharing-description {
    margin: 0;
    color: var(--text-secondary);
  }
  
  .sharing-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  
  .sharing-section,
  .collaboration-section {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  
  .sharing-section h3,
  .collaboration-section h3 {
    margin: 0 0 var(--space-4) 0;
    color: var(--text-primary);
  }
  
  .shared-workspaces,
  .collaborators-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .share-item,
  .collaborator-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .share-item:hover,
  .collaborator-item:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }
  
  .collaborator-item.pending {
    opacity: 0.7;
    border-color: var(--border-warning);
  }
  
  .share-info,
  .collaborator-info {
    flex: 1;
  }
  
  .share-title,
  .collaborator-name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .share-meta,
  .collaborator-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
  }
  
  .share-meta span,
  .collaborator-meta span {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .share-stats {
    display: flex;
    gap: var(--space-4);
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .share-actions,
  .collaborator-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin: var(--space-2) 0 0 0;
  }
  
  .empty-description {
    font-size: var(--font-size-sm);
    margin-top: var(--space-1) !important;
  }
  
  .share-form,
  .invite-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 400px;
  }
  
  .field-description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: var(--space-1) 0 0 0;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  .share-link-display {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  .link-container {
    display: flex;
    gap: var(--space-2);
  }
  
  .link-container Input {
    flex: 1;
  }
  
  @media (max-width: 1024px) {
    .sharing-content {
      grid-template-columns: 1fr;
    }
  }
  
  @media (max-width: 768px) {
    .share-item,
    .collaborator-item {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    
    .share-actions,
    .collaborator-actions {
      justify-content: flex-end;
    }
    
    .share-form,
    .invite-form {
      min-width: auto;
    }
  }
</style>
